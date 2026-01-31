import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';

interface IconButtonProps {
  onPress: () => void;
  icon?: string; // name of icon in assets/icons (without .svg)
  size?: number;
  color?: string;
  style?: any;
  materialIcon?: string; // fallback to MaterialIcons if icon not found
  materialIconSize?: number;
  materialIconColor?: string;
  testID?: string;
}

export default function IconButton({
  onPress,
  icon,
  size = 24,
  color = '#FFFFFF',
  style,
  materialIcon,
  materialIconSize,
  materialIconColor,
  testID,
}: IconButtonProps) {
  // Map icon names to SVG URI
  const getIconUri = (iconName: string) => {
    // Using require to import SVG assets
    const iconMap: { [key: string]: any } = {
      add: require('../assets/icons/add.svg'),
      alert: require('../assets/icons/alert.svg'),
      devices: require('../assets/icons/devices.svg'),
      profile: require('../assets/icons/profile.svg'),
    };
    return iconMap[iconName];
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.button, style]}
      testID={testID}
      activeOpacity={0.7}
    >
      {icon ? (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
          <SvgUri
            width={size}
            height={size}
            uri={`data:image/svg+xml;utf8,${require(`../assets/icons/${icon}.svg`)}`}
            color={color}
          />
        </View>
      ) : materialIcon ? (
        <MaterialIcons
          name={materialIcon}
          size={materialIconSize || size}
          color={materialIconColor || color}
        />
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
});
