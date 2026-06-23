function domainCompanyName(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return 'Imported customer'
  const withoutProtocol = trimmed.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
  const host = withoutProtocol.split(/[/?#]/)[0] || withoutProtocol
  const domain = host.split('@').pop() || host
  const name = domain.split('.')[0] || domain
  return name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Imported customer'
}

function csvEscape(value: string) {
  const normalized = value.replace(/\r?\n/g, ' ').trim()
  return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized
}

export function letterRowsToCsv(input: string) {
  const raw = input.trim()
  if (!raw) return ''
  const firstLine = raw.split(/\r?\n/)[0]?.toLowerCase() ?? ''
  if (/company|公司|email|邮箱|website|网站/.test(firstLine)) return raw
  const rows = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const converted = rows.map((line) => {
    const cells = line.split(/[\t,，]+/).map((item) => item.trim()).filter(Boolean)
    const email = cells.find((item) => /@/.test(item)) ?? ''
    const website = cells.find((item) => item !== email && !/@/.test(item) && (/^https?:\/\//i.test(item) || /\.[a-z]{2,}(\/|$)/i.test(item))) ?? ''
    const contactName = cells.find((item) => item !== email && item !== website) ?? ''
    const companyName = domainCompanyName(website || email)
    return [companyName, email, website, contactName].map(csvEscape).join(',')
  })
  return ['company,email,website,contactName', ...converted].join('\n')
}
