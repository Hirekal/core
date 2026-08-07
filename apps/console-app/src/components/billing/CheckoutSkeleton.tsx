/**
 * @fileoverview Skeleton placeholder matching the two-column checkout layout.
 */
export default function CheckoutSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="overflow-hidden rounded-xl border border-[#e6ebf1] bg-white shadow-sm lg:grid lg:grid-cols-2">
        <div className="flex h-full flex-col bg-[#f6f9fc] px-6 py-8 sm:px-10 lg:px-12">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-full bg-[#e6ebf1]" />
            <div className="h-4 w-24 animate-pulse rounded bg-[#e6ebf1]" />
          </div>

          <div className="mt-10 space-y-3">
            <div className="h-4 w-28 animate-pulse rounded bg-[#e6ebf1]" />
            <div className="h-9 w-48 animate-pulse rounded bg-[#dde3ea]" />
            <div className="h-5 w-36 animate-pulse rounded bg-[#e6ebf1]" />
          </div>

          <div className="mt-8 h-10 w-full max-w-xs animate-pulse rounded-lg bg-[#e6ebf1]" />

          <div className="mt-10 space-y-4 border-t border-[#e6ebf1] pt-8">
            <div className="flex items-center justify-between gap-4">
              <div className="h-4 w-32 animate-pulse rounded bg-[#e6ebf1]" />
              <div className="h-4 w-20 animate-pulse rounded bg-[#e6ebf1]" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="h-4 w-24 animate-pulse rounded bg-[#e6ebf1]" />
              <div className="h-4 w-16 animate-pulse rounded bg-[#e6ebf1]" />
            </div>
            <div className="flex items-center justify-between gap-4 pt-2">
              <div className="h-5 w-28 animate-pulse rounded bg-[#dde3ea]" />
              <div className="h-6 w-24 animate-pulse rounded bg-[#dde3ea]" />
            </div>
          </div>

          <div className="mt-8 h-4 w-40 animate-pulse rounded bg-[#e6ebf1]" />
        </div>

        <div className="px-6 py-8 sm:px-10 lg:px-12">
          <div className="h-6 w-40 animate-pulse rounded bg-[#e6ebf1]" />

          <div className="mt-8 space-y-5">
            <div className="space-y-2">
              <div className="h-3 w-16 animate-pulse rounded bg-[#e6ebf1]" />
              <div className="h-12 w-full animate-pulse rounded-md bg-[#f0f3f7]" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-20 animate-pulse rounded bg-[#e6ebf1]" />
              <div className="h-12 w-full animate-pulse rounded-md bg-[#f0f3f7]" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-28 animate-pulse rounded bg-[#e6ebf1]" />
              <div className="h-12 w-full animate-pulse rounded-md bg-[#f0f3f7]" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-12 animate-pulse rounded-md bg-[#f0f3f7]" />
                <div className="h-12 animate-pulse rounded-md bg-[#f0f3f7]" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-36 animate-pulse rounded bg-[#e6ebf1]" />
              <div className="h-12 w-full animate-pulse rounded-md bg-[#f0f3f7]" />
            </div>
          </div>

          <div className="mt-8 h-12 w-full animate-pulse rounded-md bg-[#dde3ea]" />
          <div className="mt-4 h-3 w-3/4 animate-pulse rounded bg-[#e6ebf1]" />
        </div>
      </div>
    </div>
  );
}
