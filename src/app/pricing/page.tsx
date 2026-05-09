import MaxWidthWrapper from '@/components/MaxWidthWrapper'
import { buttonVariants } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { ArrowRight, Check, Minus } from 'lucide-react'
import Link from 'next/link'
import { pricingItems } from '@/constants/pricing'

const Page = () => {
  return (
    <MaxWidthWrapper className='mb-8 mt-24 text-center max-w-7xl'>
      <div className='mx-auto mb-10 sm:max-w-lg'>
        <h1 className='text-6xl font-bold sm:text-7xl'>Pricing</h1>
        <p className='mt-5 text-gray-600 sm:text-lg'>
          Whether you&apos;re just trying out our service or need more, we&apos;ve got you covered.
        </p>
      </div>

      <div className='pt-12 grid grid-cols-1 gap-10 lg:grid-cols-3'>
        <TooltipProvider>
          {pricingItems.map(({ plan, tagline, price, quota, features }) => (
            <div key={plan} className='relative rounded-2xl bg-white shadow-lg border border-gray-200'>
              <div className='p-5'>
                <h3 className='my-3 text-center font-display text-3xl font-bold'>{plan}</h3>
                <p className='text-gray-500'>{tagline}</p>
                <p className='my-5 font-display text-6xl font-semibold'>
                  {price === 0 ? '₹0' : `₹${price.toLocaleString('en-IN')}`}
                </p>
                <p className='text-gray-500'>per month</p>
              </div>
              <div className='flex h-20 items-center justify-center border-b border-t border-gray-200 bg-gray-50'>
                <p>{quota.toLocaleString()} PDFs/mo included</p>
              </div>
              <ul className='my-10 space-y-5 px-8'>
                {features.map(({ text, negative }) => (
                  <li key={text} className='flex space-x-5'>
                    <div className='flex-shrink-0'>
                      {negative ? (
                        <Minus className='h-6 w-6 text-gray-300' />
                      ) : (
                        <Check className='h-6 w-6 text-blue-500' />
                      )}
                    </div>
                    <p className={cn('text-gray-600', { 'text-gray-400': negative })}>{text}</p>
                  </li>
                ))}
              </ul>
              <div className='border-t border-gray-200' />
              <div className='p-5'>
                <Link href='/login' className={buttonVariants({ className: 'w-full' })}>
                  Sign up <ArrowRight className='h-5 w-5 ml-1.5' />
                </Link>
              </div>
            </div>
          ))}
        </TooltipProvider>
      </div>
    </MaxWidthWrapper>
  )
}

export default Page