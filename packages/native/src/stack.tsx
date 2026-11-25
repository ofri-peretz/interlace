/** A row or column with a gap from the space scale. The layout primitive every screen is built from. */
import { memo } from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';
import { SPACE, type Space } from './scale';

export interface StackProps extends ViewProps {
  direction?: 'column' | 'row';
  gap?: Space;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
  /** Padding on every side, from the same scale. */
  padding?: Space;
  flex?: number;
}

export const Stack = memo(function Stack({
  direction = 'column',
  gap = 'md',
  align,
  justify,
  wrap,
  padding,
  flex,
  style,
  ...rest
}: StackProps) {
  return (
    <View
      style={[
        {
          flexDirection: direction,
          gap: SPACE[gap],
          alignItems: align,
          justifyContent: justify,
          flexWrap: wrap ? 'wrap' : undefined,
          padding: padding ? SPACE[padding] : undefined,
          flex,
        },
        style,
      ]}
      {...rest}
    />
  );
});
