/**
 * Skeleton Loading Placeholders Component
 */

export function tableSkeleton(rows = 6) {
  return `
    <div class="paper-card rounded-xl overflow-hidden p-4">
      <div class="space-y-3">
        ${Array.from({ length: rows }).map(() => `
          <div class="flex items-center gap-3 py-2 border-b gold-hairline">
            <div class="h-5 skeleton w-1/6"></div>
            <div class="h-5 skeleton w-2/6"></div>
            <div class="h-5 skeleton w-1/6"></div>
            <div class="h-5 skeleton w-1/6"></div>
            <div class="h-5 skeleton w-1/6"></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

export function gridSkeleton(cards = 6) {
  return `
    <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      ${Array.from({ length: cards }).map(() => `
        <div class="paper-card rounded-xl p-4 md:p-5 space-y-3">
          <div class="flex justify-between">
            <div class="h-4 skeleton w-1/3"></div>
            <div class="h-4 skeleton w-16"></div>
          </div>
          <div class="h-6 skeleton w-3/4"></div>
          <div class="h-4 skeleton w-1/2"></div>
          <div class="h-8 skeleton w-full mt-4"></div>
        </div>
      `).join('')}
    </div>
  `;
}

export function detailSkeleton() {
  return `
    <div class="paper-card rounded-2xl p-6 md:p-8 space-y-6">
      <div class="flex justify-between items-center">
        <div class="h-8 skeleton w-1/3"></div>
        <div class="h-8 skeleton w-24"></div>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="h-16 skeleton rounded-xl"></div>
        <div class="h-16 skeleton rounded-xl"></div>
        <div class="h-16 skeleton rounded-xl"></div>
        <div class="h-16 skeleton rounded-xl"></div>
      </div>
      <div class="h-48 skeleton rounded-xl"></div>
    </div>
  `;
}
