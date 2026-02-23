import type { Preview } from '@storybook/react';
import '@nostrstack/tokens/css';
import '../src/web.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    }
  }
};

export default preview;
