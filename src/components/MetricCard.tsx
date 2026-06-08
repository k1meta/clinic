export default function MetricCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
  subColor,
  subIcon,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
  subIcon?: string;
}) {
  return (
    <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-surface-container-high/50 flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
          <span className={`material-symbols-outlined ${iconColor} text-lg`}>{icon}</span>
        </div>
        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider font-headline">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-headline font-black text-on-surface">{value}</span>
        {sub && (
          <span className={`text-[10px] font-bold ${subColor || 'text-on-surface-variant'} flex items-center`}>
            {subIcon && <span className="material-symbols-outlined text-xs mr-0.5">{subIcon}</span>}
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}
