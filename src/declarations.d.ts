declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.css' {
  const content: string;
  export default content;
}

import 'react-native';

declare module 'react-native' {
  interface PressableProps {
    title?: string;
  }
  interface ViewProps {
    title?: string;
  }
  interface TouchableOpacityProps {
    title?: string;
  }
  interface TextProps {
    title?: string;
  }
}


