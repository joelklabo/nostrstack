import type { Event } from 'nostr-tools';
import { useMemo, useState } from 'react';

import { navigateTo } from '../utils/navigation';
import { NostrEventCard } from './NostrEventCard';

type ThreadedRepliesProps = {
  events: Event[];
  rootId: string;
  apiBase: string;
  enableRegtestPay: boolean;
};

function getParentId(event: Event, rootId: string): string {
  const eTags = event.tags.filter((t) => t[0] === 'e');
  if (eTags.length === 0) return rootId; // Should not happen for a reply, but fallback

  // 1. Check for explicit 'reply' marker
  const replyTag = eTags.find((t) => t[3] === 'reply');
  if (replyTag) return replyTag[1];

  // 2. Check for explicit 'root' marker
  const rootTag = eTags.find((t) => t[3] === 'root');
  if (rootTag) return rootTag[1];
  
  // 3. Positional (last e-tag is usually the parent/reply)
  // If the last e-tag is the rootId, then it's a direct reply to root.
  const lastTag = eTags[eTags.length - 1];
  return lastTag[1];
}

function buildThreadTree(events: Event[], rootId: string) {
  const childrenMap = new Map<string, Event[]>();
  const knownIds = new Set(events.map((e) => e.id));
  knownIds.add(rootId);

  // Group events by their parent
  events.forEach((event) => {
    let parentId = getParentId(event, rootId);
    
    // If parent is not in our known list (e.g. reply to a reply we didn't fetch), 
    // treat it as a top-level reply to root (or maybe orphaned).
    // For better UX, let's attach orphaned replies to rootId visually, or put them in a separate bucket.
    // Here we'll just attach to root if parent is missing.
    if (!knownIds.has(parentId)) {
       parentId = rootId;
    }

    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)?.push(event);
  });

  // Sort siblings by time
  childrenMap.forEach((siblings) => {
    siblings.sort((a, b) => a.created_at - b.created_at);
  });

  return childrenMap;
}

function ReplyNode({ 
  event, 
  childrenMap, 
  depth, 
  apiBase, 
  enableRegtestPay,
  path = []
}: { 
  event: Event; 
  childrenMap: Map<string, Event[]>; 
  depth: number;
  apiBase: string;
  enableRegtestPay: boolean;
  path?: string[];
}) {
  const [collapsed, setCollapsed] = useState(false);
  const children = childrenMap.get(event.id) || [];
  const hasChildren = children.length > 0;
  const currentPath = [...path, event.id];

  // Max depth to prevent infinite indentation squishing
  const isTooDeep = depth > 5;
  
  return (
    <div className={`thread-node ${depth > 0 ? 'thread-child' : ''}`} style={{ marginLeft: isTooDeep ? 0 : (depth > 0 ? '1.5rem' : 0) }}>
      <div className="thread-content">
         {/* Vertical line for threading if needed, or handled by CSS on thread-child */}
         <NostrEventCard 
            event={event} 
            variant="compact"
            apiBase={apiBase} 
            enableRegtestPay={enableRegtestPay} 
            onOpenThread={() => navigateTo(`/nostr/${event.id}`)}
         />
         {hasChildren && (
             <button 
                className="thread-collapse-btn" 
                onClick={() => setCollapsed(!collapsed)}
                style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-fg-muted)',
                    background: 'none',
                    border: 'none',
                    padding: '0.25rem',
                    cursor: 'pointer',
                    display: 'block',
                    marginBottom: '0.5rem'
                }}
             >
                {collapsed ? `Show ${children.length} replies` : ''}
             </button>
         )}
      </div>
      
      {!collapsed && hasChildren && (
        <div className="thread-children" style={{ 
            borderLeft: isTooDeep ? 'none' : '2px solid var(--color-border-muted)',
            paddingLeft: isTooDeep ? 0 : '0.5rem', 
            marginLeft: isTooDeep ? 0 : '0.5rem'
        }}>
          {children.map((child) => {
            if (currentPath.includes(child.id)) return null;
            return (
              <ReplyNode 
                key={child.id} 
                event={child} 
                childrenMap={childrenMap} 
                depth={depth + 1}
                apiBase={apiBase}
                enableRegtestPay={enableRegtestPay}
                path={currentPath}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ThreadedReplies({ events, rootId, apiBase, enableRegtestPay }: ThreadedRepliesProps) {
  const childrenMap = useMemo(() => buildThreadTree(events, rootId), [events, rootId]);
  const rootReplies = childrenMap.get(rootId) || [];

  if (rootReplies.length === 0 && events.length > 0) {
      // Fallback: if everything is orphaned (maybe logic issue), show all as flat?
      // With our logic, orphaned nodes are attached to rootId, so this shouldn't happen 
      // unless events is empty.
  }

  return (
    <div className="threaded-replies">
      {rootReplies.map((reply) => (
        <ReplyNode 
          key={reply.id} 
          event={reply} 
          childrenMap={childrenMap} 
          depth={0} 
          apiBase={apiBase} 
          enableRegtestPay={enableRegtestPay}
        />
      ))}
    </div>
  );
}
