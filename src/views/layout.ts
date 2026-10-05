/**
 * Application Layout Template
 * Provides the modern RTL HTML5 layout with Tailwind, Cairo & Amiri fonts, and mobile-optimized viewport
 */
export function renderAppLayout(): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0"/>
  <meta name="theme-color" content="#0B1F3A"/>
  <meta name="description" content="نظام إدارة مكتب الشريف وشركاه للمحاماة — إدارة القضايا، الجلسات، التوكيلات، والأتعاب"/>
  <title>الشريف وشركاه — نظام إدارة المكتب</title>
  <link rel="icon" href="/static/img/logo.png"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Amiri:wght@400;700&family=Cormorant+Garamond:wght@600;700&display=swap" rel="stylesheet"/>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.2/css/all.min.css" rel="stylesheet"/>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js" defer></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            navy: { 950:'#070F1C', 900:'#0B1F3A', 800:'#12284A', 700:'#1A3A63', 600:'#1F4E79' },
            gold: { 500:'#C9A227', 400:'#E0C36A', 300:'#F0D78C', 700:'#8B6914' },
            ivory:'#F6F1E7', ink:'#1A140A', walnut:'#3B2A1A'
          },
          fontFamily: { cairo:['Cairo','sans-serif'], amiri:['Amiri','serif'], corm:['Cormorant Garamond','serif'] }
        }
      }
    }
  </script>
  <link href="/static/style.css" rel="stylesheet"/>
</head>
<body class="font-cairo bg-ivory text-ink antialiased selection:bg-gold-500 selection:text-navy-950">
  <div id="app"></div>
  <script src="/static/app.js" defer></script>
</body>
</html>`
}
