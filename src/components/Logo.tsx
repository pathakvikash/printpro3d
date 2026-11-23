type Props = { size?: number; showWordmark?: boolean; className?: string };

// Isometric part: solid top, shaded right face, left face built from three printed layers.
export default function Logo({ size = 28, showWordmark = true, className = '' }: Props) {
  return (
    <span role='img' aria-label='PrintPro3D' className={`inline-flex items-center gap-2 ${className}`}>
      <svg aria-hidden='true' width={size} height={size} viewBox='0 0 24 24' className='shrink-0 text-indigo-500 dark:text-indigo-400' fill='currentColor'>
        <path d='M12 2l8.66 5L12 12 3.34 7z' />
        <path opacity='.55' d='M12 12l8.66-5v10L12 22z' />
        <path d='M3.34 7L12 12v3L3.34 10zM3.34 10.5L12 15.5v3l-8.66-5zM3.34 14L12 19v3l-8.66-5z' />
      </svg>
      {showWordmark && (
        <span aria-hidden='true' className='font-bold leading-none tracking-tight' style={{ fontSize: size * 0.75 }}>
          PrintPro<span className='text-indigo-500 dark:text-indigo-400'>3D</span>
        </span>
      )}
    </span>
  );
}
