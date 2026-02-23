export interface User {
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface Post {
  id: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface WebContract {
  version: "1";
  supportedEntities: ("user" | "post" | "wallet")[];
}
