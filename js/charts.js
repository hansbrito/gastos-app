// ECharts wrappers with a shared theme derived from the design tokens.
// Interactive: tooltips on tap, animated, responsive to resize + theme change.
import * as echarts from 'https://cdn.jsdelivr.net/npm/echarts@5.6.0/dist/echarts.esm.min.js'
import { brl, brlShort } from './store.js'

const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

const instances = new Set()
addEventListener('resize', () => instances.forEach(c => c.resize()))

function mount(el, option) {
  const chart = echarts.init(el, null, { renderer: 'svg' })
  chart.setOption(option)
  instances.add(chart)
  return chart
}

const baseAxis = () => ({
  axisLine: { show: false }, axisTick: { show: false },
  axisLabel: { color: css('--color-text-muted'), fontSize: 11 },
  splitLine: { lineStyle: { color: css('--color-border'), type: 'dashed' } },
})

const baseTooltip = () => ({
  trigger: 'axis',
  confine: true,
  backgroundColor: css('--color-surface'),
  borderColor: css('--color-border'),
  textStyle: { color: css('--color-text'), fontSize: 13 },
})

/** Monthly totals bar chart. items: [{label, value, on}] */
export function monthlyBars(el, items) {
  return mount(el, {
    grid: { left: 8, right: 8, top: 28, bottom: 24, containLabel: true },
    tooltip: { ...baseTooltip(), formatter: p => `<b>${p[0].name}</b><br>${brl(p[0].value)}` },
    xAxis: { type: 'category', data: items.map(i => i.label), ...baseAxis(), splitLine: { show: false } },
    yAxis: { type: 'value', ...baseAxis(), axisLabel: { ...baseAxis().axisLabel, formatter: v => brlShort(v) } },
    series: [{
      type: 'bar',
      data: items.map(i => ({
        value: Math.round(i.value * 100) / 100,
        itemStyle: { color: i.on ? css('--color-primary') : css('--color-surface-2'), borderRadius: [6, 6, 0, 0] },
      })),
      barMaxWidth: 34,
      label: { show: true, position: 'top', fontSize: 10, color: css('--color-text-muted'), formatter: p => p.value ? brlShort(p.value) : '' },
    }],
  })
}

/**
 * Waterfall: last month → per-category change → this month.
 * Spending increases are negative-red, decreases positive-green.
 */
export function waterfall(el, { prevLabel, curLabel, prevTotal, curTotal, deltas }) {
  const labels = [prevLabel, ...deltas.map(d => d.cat), curLabel]
  const placeholder = [0], change = [{
    value: Math.round(prevTotal * 100) / 100,
    itemStyle: { color: css('--color-surface-2'), borderRadius: [6, 6, 0, 0] },
  }]
  let run = prevTotal
  for (const d of deltas) {
    placeholder.push(Math.round(Math.min(run, run + d.delta) * 100) / 100)
    change.push({
      value: Math.round(Math.abs(d.delta) * 100) / 100,
      delta: d.delta,
      itemStyle: { color: d.delta > 0 ? css('--color-negative') : css('--color-positive'), borderRadius: 4 },
    })
    run += d.delta
  }
  placeholder.push(0)
  change.push({
    value: Math.round(curTotal * 100) / 100,
    itemStyle: { color: css('--color-primary'), borderRadius: [6, 6, 0, 0] },
  })

  return mount(el, {
    grid: { left: 8, right: 8, top: 12, bottom: 8, containLabel: true },
    tooltip: {
      ...baseTooltip(),
      formatter: ps => {
        const p = ps.find(x => x.seriesIndex === 1)
        if (!p) return ''
        const d = p.data.delta
        if (d === undefined) return `<b>${p.name}</b><br>${brl(p.value)}`
        return `<b>${p.name}</b><br>${d > 0 ? '▲ gastamos' : '▼ economizamos'} ${brl(Math.abs(d))}`
      },
    },
    xAxis: {
      type: 'category', data: labels, ...baseAxis(), splitLine: { show: false },
      axisLabel: { ...baseAxis().axisLabel, interval: 0, rotate: labels.length > 5 ? 35 : 0 },
    },
    yAxis: { type: 'value', ...baseAxis(), axisLabel: { ...baseAxis().axisLabel, formatter: v => brlShort(v) } },
    series: [
      { type: 'bar', stack: 'w', itemStyle: { color: 'transparent' }, emphasis: { itemStyle: { color: 'transparent' } }, data: placeholder, tooltip: { show: false } },
      { type: 'bar', stack: 'w', data: change, barMaxWidth: 34 },
    ],
  })
}
