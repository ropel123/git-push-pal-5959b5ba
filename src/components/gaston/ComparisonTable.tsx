import { COMPARISON_SECTION } from "@/lib/gastonContent";

/** Tableau comparatif Sans Gaston / Avec Gaston. */
const ComparisonTable = () => (
  <div className="overflow-x-auto rounded-2xl border border-[#0f1d34]/8 bg-white shadow-sm">
    <table className="w-full min-w-[420px] border-collapse text-left">
      <caption className="sr-only">{COMPARISON_SECTION.title}</caption>
      <thead>
        <tr className="border-b border-[#0f1d34]/8">
          <th scope="col" className="px-5 py-4 text-[15px] font-bold text-[#0f1d34]">
            {/* tâche */}
          </th>
          <th scope="col" className="px-5 py-4 text-[15px] font-bold text-[#0f1d34]/60">
            {COMPARISON_SECTION.withoutLabel}
          </th>
          <th scope="col" className="px-5 py-4 text-[15px] font-bold text-[#1d4ed8]">
            {COMPARISON_SECTION.withLabel}
          </th>
        </tr>
      </thead>
      <tbody>
        {COMPARISON_SECTION.rows.map((row, i) => (
          <tr key={row.task} className={i < COMPARISON_SECTION.rows.length - 1 ? "border-b border-[#0f1d34]/6" : ""}>
            <th scope="row" className="px-5 py-4 text-[15px] font-bold text-[#0f1d34]">
              {row.task}
            </th>
            <td className="px-5 py-4 text-[15px] text-[#0f1d34]/60 line-through decoration-[#0f1d34]/30">
              {row.without}
            </td>
            <td className="px-5 py-4 text-[15px] font-extrabold text-[#1d4ed8]">{row.with}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default ComparisonTable;
