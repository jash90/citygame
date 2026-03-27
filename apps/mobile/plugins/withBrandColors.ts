import { withAndroidColors, type ConfigPlugin } from 'expo/config-plugins';

interface ColorItem {
  $: { name: string };
  _: string;
}

const withBrandColors: ConfigPlugin = (config) => {
  const primaryColor =
    config.android?.adaptiveIcon?.backgroundColor ?? '#FF6B35';

  return withAndroidColors(config, (modConfig) => {
    const resourceColors = (
      modConfig.modResults.resources?.color ?? []
    ) as ColorItem[];

    const setColor = (name: string, value: string): void => {
      const existing = resourceColors.find((c) => c.$.name === name);
      if (existing) {
        existing._ = value;
      } else {
        resourceColors.push({ $: { name }, _: value });
      }
    };

    setColor('splashscreen_background', primaryColor);
    setColor('iconBackground', primaryColor);
    setColor('colorPrimaryDark', primaryColor);

    if (!modConfig.modResults.resources) {
      modConfig.modResults.resources = {};
    }
    (modConfig.modResults.resources as Record<string, unknown>).color =
      resourceColors;

    return modConfig;
  });
};

export default withBrandColors;
