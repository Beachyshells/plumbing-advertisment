import { buildContractSections } from './contractLayout.js'

// Shows a layout-2 contract the way it reads on paper: title, company
// details, then each section in order. Used on both Michael's contract page
// and the customer's signing page. Renders nothing for original-layout
// contracts, which keep their old display.
export default function ContractSections({ contract }) {
    const built = buildContractSections(contract)
    if (!built) return null
    const { title, company, sections } = built

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-5">
            <div className="flex flex-col gap-1 border-b border-white/10 pb-4">
                <p className="text-white text-lg font-serif">{title}</p>
                {company && (
                    <p className="text-white/40 text-xs leading-relaxed">
                        {[company.name, [company.street, company.cityStateZip].filter(Boolean).join(', '), company.phone, company.email]
                            .filter(Boolean)
                            .join(' · ')}
                    </p>
                )}
            </div>

            {sections.map((section) => (
                <section key={section.key}>
                    <p className="text-white/40 text-xs uppercase tracking-widest mb-2">{section.title}</p>

                    {section.kind === 'lines' && (
                        <div className="text-white text-sm flex flex-col gap-0.5">
                            {section.lines.map((line, i) => <p key={i}>{line}</p>)}
                        </div>
                    )}

                    {section.kind === 'text' && (
                        <p className="text-white text-sm whitespace-pre-wrap">{section.text}</p>
                    )}

                    {section.kind === 'items' && (
                        <ul className="text-white text-sm flex flex-col gap-1">
                            {section.items.map((item, i) => (
                                <li key={i} className="flex gap-2">
                                    {section.showChangeType && (
                                        <span className={`w-12 shrink-0 text-xs font-semibold pt-0.5 ${item.changeType === 'remove' ? 'text-red-400' : 'text-brand-green'}`}>
                                            {item.changeType === 'remove' ? 'Remove' : 'Add'}
                                        </span>
                                    )}
                                    <span className="text-white/50 w-8 shrink-0">{item.quantity} ×</span>
                                    <span>
                                        {item.name}
                                        {item.detail && <span className="text-white/50"> — {item.detail}</span>}
                                    </span>
                                </li>
                            ))}
                            {section.extraScope.map((line, i) => (
                                <li key={`extra-${i}`} className="flex gap-2">
                                    {section.showChangeType && <span className="w-12 shrink-0" />}
                                    <span className="text-white/50 w-8 shrink-0">•</span>
                                    <span>{line}</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    {section.kind === 'price' && (
                        <div className="flex flex-col gap-1">
                            {section.rows.map((row, i) => (
                                <div key={i} className="flex items-baseline justify-between gap-4">
                                    <p className={row.emphasis ? 'text-white text-sm font-semibold' : 'text-white/70 text-sm'}>{row.label}</p>
                                    <p className={row.emphasis ? 'text-white text-lg font-serif' : 'text-white text-sm'}>{row.value}</p>
                                </div>
                            ))}
                            {section.notes && <p className="text-white/50 text-xs mt-1 italic whitespace-pre-wrap">{section.notes}</p>}
                        </div>
                    )}

                    {section.kind === 'terms' && (
                        <p className="text-white/70 text-xs whitespace-pre-wrap leading-relaxed">{section.text}</p>
                    )}
                </section>
            ))}
        </div>
    )
}
