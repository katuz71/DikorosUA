declare module 'react-native-render-html' {
  import { Component } from 'react';
  import { TextStyle } from 'react-native';

  export interface RenderHTMLProps {
    source: { html: string };
    contentWidth: number;
    baseStyle?: TextStyle;
    tagsStyles?: Record<string, TextStyle>;
  }

  const RenderHTML: React.ComponentType<RenderHTMLProps>;
  export default RenderHTML;
}
