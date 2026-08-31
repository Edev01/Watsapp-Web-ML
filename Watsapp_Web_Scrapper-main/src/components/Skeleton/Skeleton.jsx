import { motion } from 'framer-motion'

export const Skeleton = ({
  className = '',
  variant = 'rounded',
  width,
  height,
  animation = 'shimmer',
}) => {
  const baseStyles = 'bg-slate-200 dark:bg-slate-700'
  
  const variantStyles = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-lg',
  }

  const animationStyles = {
    shimmer: 'shimmer',
    pulse: 'animate-pulse',
    none: '',
  }

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${animationStyles[animation]} ${className}`}
      style={{ width, height }}
    />
  )
}

// Stat Card Skeleton
export const StatCardSkeleton = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-white/50 dark:border-slate-700 p-5 shadow-sm"
  >
    <div className="flex items-start gap-4">
      <Skeleton variant="rounded" width={48} height={48} className="rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" width="60%" height={12} />
        <Skeleton variant="text" width="40%" height={24} />
      </div>
    </div>
  </motion.div>
)

// Chart Skeleton
export const ChartSkeleton = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-white/50 dark:border-slate-700 p-6 shadow-sm h-[300px]"
  >
    <div className="flex items-center justify-between mb-4">
      <div className="space-y-2">
        <Skeleton variant="text" width={120} height={20} />
        <Skeleton variant="text" width={80} height={12} />
      </div>
      <Skeleton variant="rounded" width={36} height={36} className="rounded-lg" />
    </div>
    <div className="h-[200px] flex items-end gap-2">
      {[...Array(8)].map((_, i) => (
        <Skeleton
          key={i}
          variant="rounded"
          width="100%"
          height={`${Math.random() * 60 + 20}%`}
          className="rounded-t-lg"
        />
      ))}
    </div>
  </motion.div>
)

// Table Skeleton
export const TableSkeleton = ({ rows = 5 }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-white/50 dark:border-slate-700 shadow-sm overflow-hidden"
  >
    {/* Header */}
    <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-100 dark:border-slate-700">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} variant="text" width={`${20 + Math.random() * 15}%`} height={14} />
      ))}
    </div>
    {/* Rows */}
    <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
      {[...Array(rows)].map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-6 py-4">
          <Skeleton variant="circular" width={32} height={32} />
          <Skeleton variant="text" width="25%" height={14} />
          <Skeleton variant="text" width="20%" height={14} />
          <Skeleton variant="text" width="15%" height={14} />
          <div className="ml-auto flex gap-2">
            <Skeleton variant="rounded" width={32} height={32} className="rounded-lg" />
            <Skeleton variant="rounded" width={32} height={32} className="rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  </motion.div>
)

// Dashboard Overview Skeleton
export const DashboardOverviewSkeleton = () => (
  <div className="space-y-6">
    {/* Header */}
    <div className="space-y-2">
      <Skeleton variant="text" width={200} height={28} />
      <Skeleton variant="text" width={300} height={16} />
    </div>
    
    {/* Stats Grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {[...Array(5)].map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
    
    {/* Charts Row */}
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3">
        <ChartSkeleton />
      </div>
      <div className="lg:col-span-2">
        <ChartSkeleton />
      </div>
    </div>
    
    {/* Bottom Row */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <ChartSkeleton />
      <ChartSkeleton />
      <ChartSkeleton />
    </div>
  </div>
)

// Card Skeleton (Property Listing Grid skeleton)
export const CardSkeleton = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4"
  >
    {/* Top Badges */}
    <div className="flex gap-2">
      <Skeleton variant="rounded" width={60} height={18} />
      <Skeleton variant="rounded" width={60} height={18} />
    </div>
    {/* Title & Location */}
    <div className="space-y-2">
      <Skeleton variant="text" width="85%" height={16} />
      <Skeleton variant="text" width="50%" height={12} />
    </div>
    {/* Price */}
    <Skeleton variant="text" width="40%" height={20} />
    {/* Tags */}
    <div className="flex gap-2">
      <Skeleton variant="rounded" width={50} height={18} />
      <Skeleton variant="rounded" width={50} height={18} />
      <Skeleton variant="rounded" width={50} height={18} />
    </div>
    {/* Description */}
    <div className="space-y-1.5 pt-2">
      <Skeleton variant="text" width="100%" height={12} />
      <Skeleton variant="text" width="90%" height={12} />
    </div>
    {/* Footer */}
    <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
      <div className="space-y-1">
        <Skeleton variant="text" width={100} height={10} />
        <Skeleton variant="text" width={80} height={10} />
      </div>
      <Skeleton variant="text" width={60} height={12} />
    </div>
  </motion.div>
)

export default Skeleton
