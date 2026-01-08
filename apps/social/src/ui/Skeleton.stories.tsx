import { NotificationSkeleton, PostSkeleton, ProfileSkeleton, Skeleton } from '@nostrstack/ui';
import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'UI/Skeleton',
  component: Skeleton,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    width: 200,
    height: 20,
  },
};

export const Circle: Story = {
  args: {
    width: 60,
    height: 60,
    borderRadius: '50%',
  },
};

export const Post: StoryObj<typeof PostSkeleton> = {
  render: () => <PostSkeleton />,
};

export const Profile: StoryObj<typeof ProfileSkeleton> = {
  render: () => <ProfileSkeleton />,
};

export const Notification: StoryObj<typeof NotificationSkeleton> = {
  render: () => <NotificationSkeleton />,
};

export const Multiple: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px' }}>
      <PostSkeleton />
      <PostSkeleton />
      <PostSkeleton />
    </div>
  ),
};
