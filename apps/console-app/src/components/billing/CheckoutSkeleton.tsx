/**
 * @fileoverview Skeleton placeholder matching the full-bleed checkout layout.
 */
export default function CheckoutSkeleton() {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <div className="min-h-screen border-[#e6ebf1] bg-[#f6f9fc] shadow-[4px_0_24px_rgba(15,23,42,0.04)] lg:border-r">
        <div className="mx-auto flex h-full w-full max-w-xl flex-col px-6 py-12 sm:px-8 sm:py-14 lg:ml-auto lg:mr-0 lg:max-w-2xl lg:px-10 lg:py-16 xl:px-12">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-full bg-[#e6ebf1]" />
            <div className="h-4 w-24 animate-pulse rounded bg-[#e6ebf1]" />
          </div>

          <div className="mt-8 h-28 w-full animate-pulse rounded-md bg-[#e6ebf1]" />

          <div className="mt-8 space-y-4 border-t border-[#e6ebf1] pt-6">
            <div className="flex items-center justify-between gap-4">
              <div className="h-4 w-32 animate-pulse rounded bg-[#e6ebf1]" />
              <div className="h-4 w-20 animate-pulse rounded bg-[#e6ebf1]" />
            </div>
            <div className="flex items-center justify-between gap-4 pt-2">
              <div className="h-5 w-28 animate-pulse rounded bg-[#dde3ea]" />
              <div className="h-6 w-24 animate-pulse rounded bg-[#dde3ea]" />
            </div>
          </div>

          <div className="mt-auto pt-10 h-3 w-48 animate-pulse rounded bg-[#e6ebf1]" />
        </div>
      </div>

      <div className="min-h-screen bg-white">
        <div className="mx-auto w-full max-w-xl px-6 py-12 sm:px-8 sm:py-14 lg:ml-0 lg:mr-auto lg:max-w-2xl lg:px-10 lg:py-16 xl:px-12">
          <div className="h-6 w-40 animate-pulse rounded bg-[#e6ebf1]" />

          <div className="mt-8 space-y-5">
            <div className="space-y-2">
              <div className="h-3 w-16 animate-pulse rounded bg-[#e6ebf1]" />
              <div className="h-[44px] w-full animate-pulse rounded-md bg-[#f0f3f7]" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-28 animate-pulse rounded bg-[#e6ebf1]" />
              <div className="overflow-hidden rounded-md border border-[#e6ebf1]">
                <div className="h-[46px] animate-pulse bg-[#f0f3f7]" />
                <div className="h-[46px] animate-pulse border-t border-[#e6ebf1] bg-[#f0f3f7]" />
                <div className="h-[46px] animate-pulse border-t border-[#e6ebf1] bg-[#f0f3f7]" />
              </div>
            </div>
            <div className="space-y-2 pt-4">
              <div className="h-3 w-28 animate-pulse rounded bg-[#e6ebf1]" />
              <div className="overflow-hidden rounded-md border border-[#e6ebf1]">
                <div className="h-[44px] animate-pulse bg-[#f0f3f7]" />
                <div className="grid grid-cols-2 border-t border-[#e6ebf1]">
                  <div className="h-[44px] animate-pulse border-r border-[#e6ebf1] bg-[#f0f3f7]" />
                  <div className="h-[44px] animate-pulse bg-[#f0f3f7]" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 h-12 w-full animate-pulse rounded-md bg-[#dde3ea]" />
        </div>
      </div>
    </div>
  );
}
