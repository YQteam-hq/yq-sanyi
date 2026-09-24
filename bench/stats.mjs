function percentile(values, ratio) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0
  }
  const sorted = values.slice().sort(function (a, b) {
    return a - b
  })
  const clamped = ratio < 0 ? 0 : ratio > 1 ? 1 : ratio
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(clamped * sorted.length) - 1))
  return sorted[index]
}

function median(values) {
  return percentile(values, 0.5)
}

function spread(values) {
  const low = percentile(values, 0)
  const high = percentile(values, 1)
  if (low <= 0) {
    return high <= 0 ? 1 : Infinity
  }
  return high / low
}

function round(value, digits) {
  const factor = Math.pow(10, digits)
  return Math.round(value * factor) / factor
}

function rateFromCost(costMs) {
  if (!(costMs > 0)) {
    return 0
  }
  return 1000 / costMs
}

function formatSeries(values, digits) {
  return values
    .map(function (value) {
      return round(value, digits)
    })
    .join('/')
}

export { percentile, median, spread, round, rateFromCost, formatSeries }
