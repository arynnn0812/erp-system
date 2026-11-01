import { useTheme } from '../../context/ThemeContext.jsx';
import Icon from '../ui/Icon.jsx';

const OPTIONS = [
  { value: 'light', icon: 'sun', label: 'Light theme' },
  { value: 'dark', icon: 'moon', label: 'Dark theme' },
  { value: 'system', icon: 'monitor', label: 'Match system theme' },
];

export default function ThemeSwitch() {
  const { pref, setPref } = useTheme();
  return (
    <div className="segmented" role="group" aria-label="Colour theme">
      {OPTIONS.map((o) => (
        <button
          key={o.value} type="button" aria-pressed={pref === o.value}
          aria-label={o.label} title={o.label} onClick={() => setPref(o.value)}
        >
          <Icon name={o.icon} size={15} />
        </button>
      ))}
    </div>
  );
}
