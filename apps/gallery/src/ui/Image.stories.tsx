import type { Meta, StoryObj } from '@storybook/react';

import { Image } from './Image';

const meta = {
  title: 'UI/Image',
  component: Image,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    src: { control: 'text' },
    alt: { control: 'text' },
    fallback: { control: 'text' },
    className: { control: 'text' },
  },
} satisfies Meta<typeof Image>;

export default meta;
type Story = StoryObj<typeof meta>;

// Valid image that loads successfully
export const Default: Story = {
  args: {
    src: 'https://picsum.photos/400/300',
    alt: 'Sample image',
    style: { width: '400px', height: '300px' },
  },
};

// Image with loading state (will show skeleton initially)
export const Loading: Story = {
  args: {
    src: 'https://picsum.photos/400/300?random=1',
    alt: 'Loading image',
    style: { width: '400px', height: '300px' },
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows skeleton loader while image is loading. The skeleton will disappear once the image loads.',
      },
    },
  },
};

// Image with error and fallback
export const WithFallback: Story = {
  args: {
    src: 'https://invalid-url.example/image.jpg',
    fallback: 'https://via.placeholder.com/400x300/cccccc/666666?text=Fallback+Image',
    alt: 'Image with fallback',
    style: { width: '400px', height: '300px' },
  },
  parameters: {
    docs: {
      description: {
        story: 'When the main image fails to load, the fallback image is displayed instead.',
      },
    },
  },
};

// Image without fallback (shows broken state)
export const ErrorNoFallback: Story = {
  args: {
    src: 'https://invalid-url.example/broken.jpg',
    alt: 'Broken image without fallback',
    style: { width: '400px', height: '300px' },
  },
  parameters: {
    docs: {
      description: {
        story: 'When image fails and no fallback is provided, shows the browser default broken image icon.',
      },
    },
  },
};

// Custom styling
export const CustomStyling: Story = {
  args: {
    src: 'https://picsum.photos/400/300?random=2',
    alt: 'Styled image',
    className: 'custom-image',
    style: { 
      width: '400px', 
      height: '300px',
      borderRadius: '12px',
      border: '2px solid #0969da',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Image component accepts custom className and style props.',
      },
    },
  },
};

// Small avatar-like image
export const Avatar: Story = {
  args: {
    src: 'https://picsum.photos/200/200?random=3',
    alt: 'Avatar',
    style: { 
      width: '80px', 
      height: '80px',
      borderRadius: '50%',
    },
  },
};

// Wide image (different aspect ratio)
export const WideImage: Story = {
  args: {
    src: 'https://picsum.photos/800/400',
    alt: 'Wide image',
    style: { width: '800px', height: '400px' },
  },
};

// Missing alt text (accessibility issue)
export const MissingAlt: Story = {
  args: {
    src: 'https://picsum.photos/400/300?random=4',
    alt: '',
    style: { width: '400px', height: '300px' },
  },
  parameters: {
    docs: {
      description: {
        story: 'Image without alt text - this is an accessibility violation. Screen readers will have no description.',
      },
    },
    a11y: {
      config: {
        rules: [{ id: 'image-alt', enabled: true }],
      },
    },
  },
};

// Empty src
export const EmptySrc: Story = {
  args: {
    src: '',
    alt: 'Image with empty source',
    style: { width: '400px', height: '300px' },
  },
  parameters: {
    docs: {
      description: {
        story: 'Image with empty src - will trigger error state.',
      },
    },
  },
};

// With callbacks (for testing event handlers)
export const WithCallbacks: Story = {
  args: {
    src: 'https://picsum.photos/400/300?random=5',
    alt: 'Image with callbacks',
    style: { width: '400px', height: '300px' },
    onLoad: (e) => console.log('Image loaded:', e),
    onError: (e) => console.log('Image failed to load:', e),
  },
  parameters: {
    docs: {
      description: {
        story: 'Image with onLoad and onError callbacks. Check browser console for events.',
      },
    },
  },
};
