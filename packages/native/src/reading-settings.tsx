/**
 * Two small controls for the reader, not the theme author: a text size control and a More contrast
 * toggle. Both are controlled (the consumer owns the value and stores it, see `parseReadingPrefs`)
 * and take their words as props, so an app can translate them. Neither carries a colour of its own.
 *
 * TextSizeControl is a labelled group of three buttons: smaller, the current size (which resets to
 * 100%), larger. At an end the outer button is announced as dimmed but stays a button, so a reader
 * pressing "Larger" until it stops is not thrown out of the control.
 *
 * ContrastToggle is a switch for More contrast. It shows what is on screen, from the reader's
 * choice or the device's. Turning it off while the device asks for more stores `normal`: the reader
 * said no, and the app stops overriding them.
 */
import { memo } from 'react';
import { View } from 'react-native';
import { Button } from './button';
import { resolveMoreContrast, stepTextSize, textSizeControlModel, type ContrastPreference, type TextSize } from './reading-prefs';
import { useSystemMoreContrast } from './system-contrast';
import { useTheme } from './theme';

export interface TextSizeLabels {
  /** The group's name. @default 'Text size' */
  group?: string;
  smaller?: string;
  /** Before the current size. @default 'Reset text size' */
  reset?: string;
  larger?: string;
}

export interface TextSizeControlProps {
  value: TextSize;
  onChange: (size: TextSize) => void;
  labels?: TextSizeLabels;
}

export const TextSizeControl = memo(function TextSizeControl({ value, onChange, labels }: TextSizeControlProps) {
  const theme = useTheme();
  const { label, atMin, atMax } = textSizeControlModel(value);
  const name = {
    group: labels?.group ?? 'Text size',
    smaller: labels?.smaller ?? 'Smaller text',
    reset: labels?.reset ?? 'Reset text size',
    larger: labels?.larger ?? 'Larger text',
  };
  return (
    <View accessibilityRole="toolbar" accessibilityLabel={name.group} style={{ flexDirection: 'row', gap: theme.space.sm }}>
      <Button
        variant="outline"
        accessibilityLabel={name.smaller}
        accessibilityState={{ disabled: atMin }}
        onPress={() => !atMin && onChange(stepTextSize(value, -1))}
        testID="text-size-smaller"
      >
        A−
      </Button>
      <Button
        variant="outline"
        accessibilityLabel={`${name.reset}, ${label}`}
        onPress={() => onChange('default')}
        testID="text-size-reset"
      >
        {label}
      </Button>
      <Button
        variant="outline"
        accessibilityLabel={name.larger}
        accessibilityState={{ disabled: atMax }}
        onPress={() => !atMax && onChange(stepTextSize(value, 1))}
        testID="text-size-larger"
      >
        A+
      </Button>
    </View>
  );
});

export interface ContrastToggleProps {
  /** What the reader chose; `system` follows the device. */
  value: ContrastPreference;
  onChange: (next: ContrastPreference) => void;
  /** Visible text and accessible name. @default 'More contrast' */
  label?: string;
}

export const ContrastToggle = memo(function ContrastToggle({ value, onChange, label = 'More contrast' }: ContrastToggleProps) {
  const on = resolveMoreContrast(value, useSystemMoreContrast());
  return (
    <Button
      variant={on ? 'primary' : 'outline'}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      onPress={() => onChange(on ? 'normal' : 'more')}
      testID="contrast-toggle"
    >
      {label}
    </Button>
  );
});
