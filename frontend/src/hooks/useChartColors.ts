import { useStore } from '../store/useStore';

export function useChartColors() {
  const { theme } = useStore();
  const dark = theme === 'dark';

  return {
    axisLabel:     dark ? '#c9d1d9' : '#424a53',
    axisMuted:     dark ? '#8b949e' : '#6e7781',
    gridLine:      dark ? '#30363d' : '#d0d7de',
    legendText:    dark ? '#c9d1d9' : '#424a53',
    tooltipBg:     dark ? '#1c2128' : '#ffffff',
    tooltipBorder: dark ? '#30363d' : '#d0d7de',
    tooltipText:   dark ? '#e6edf3' : '#1f2328',
    barLabelRight: dark ? '#c9d1d9' : '#424a53',
    barLabelTop:   dark ? '#c9d1d9' : '#424a53',
  };
}
