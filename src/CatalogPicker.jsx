import { useState } from 'react'

// The parts catalog with category pills, search, and color-coded groups —
// the same look and behavior as the Service Call screen's catalog, shared
// by the invoice Edit screen and the employee parts screen.
//
//   inventory — catalog items ({ _id, name, sellPrice, category, isEquipment })
//   onPick(item) — called when an item is tapped
//   formatPrice(amount) — how prices are shown

const CATEGORY_PILLS = ['All', 'Equipment', 'Filters', 'Plumbing', 'Electrical', 'Heating', 'Other']

const CATEGORY_COLORS = {
    Equipment: { active: 'bg-purple-500 text-white', inactive: 'text-purple-300 border-purple-500/40', accent: 'border-l-purple-500' },
    Filters: { active: 'bg-teal-500 text-white', inactive: 'text-teal-300 border-teal-500/40', accent: 'border-l-teal-500' },
    Plumbing: { active: 'bg-blue-500 text-white', inactive: 'text-blue-300 border-blue-500/40', accent: 'border-l-blue-500' },
    Electrical: { active: 'bg-yellow-500 text-navy', inactive: 'text-yellow-300 border-yellow-500/40', accent: 'border-l-yellow-500' },
    Heating: { active: 'bg-orange-500 text-white', inactive: 'text-orange-300 border-orange-500/40', accent: 'border-l-orange-500' },
    Other: { active: 'bg-white/30 text-white', inactive: 'text-white/50 border-white/20', accent: 'border-l-white/30' },
}

// Which group an item belongs to. Filters get their own group even when
// they're also tracked equipment.
function itemCategory(item) {
    if (item.category === 'Filters') return 'Filters'
    if (item.isEquipment) return 'Equipment'
    return CATEGORY_COLORS[item.category] ? item.category : 'Other'
}

function ItemButton({ item, onPick, formatPrice }) {
    const colors = CATEGORY_COLORS[itemCategory(item)]
    return (
        <button
            onClick={() => onPick(item)}
            className={`text-left bg-white/5 hover:bg-white/10 border border-white/10 border-l-4 ${colors.accent} rounded-xl px-4 py-3 transition-colors flex items-center justify-between gap-3`}
        >
            <p className="text-white text-sm">{item.name}</p>
            <p className="text-white/40 text-xs shrink-0">{formatPrice(item.sellPrice)}</p>
        </button>
    )
}

export default function CatalogPicker({ inventory, onPick, formatPrice = (n) => `$${Number(n || 0).toFixed(2)}`, placeholder = 'Search parts...' }) {
    const [category, setCategory] = useState('All')
    const [search, setSearch] = useState('')
    const [openGroups, setOpenGroups] = useState({})

    const term = search.trim().toLowerCase()
    const matches = (item) => !term || item.name?.toLowerCase().includes(term)
    const byName = (a, b) => (a.name || '').localeCompare(b.name || '')

    const groups = CATEGORY_PILLS.filter((c) => c !== 'All')
        .map((c) => ({ category: c, items: inventory.filter((i) => itemCategory(i) === c && matches(i)).sort(byName) }))
        .filter((g) => g.items.length > 0)

    const oneCategory = category === 'All' ? [] : inventory.filter((i) => itemCategory(i) === category && matches(i)).sort(byName)

    return (
        <div>
            <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
                {CATEGORY_PILLS.map((pill) => {
                    const isActive = category === pill
                    const colors = CATEGORY_COLORS[pill]
                    const activeClass = pill === 'All' ? 'bg-blue text-white' : colors.active
                    const inactiveClass = pill === 'All' ? 'bg-white/5 text-white/50 border border-white/10' : `bg-white/5 border ${colors.inactive}`
                    return (
                        <button
                            key={pill}
                            onClick={() => setCategory(pill)}
                            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${isActive ? activeClass : inactiveClass}`}
                        >
                            {pill}
                        </button>
                    )
                })}
            </div>

            <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-base py-3 px-4 outline-none focus:border-blue mb-2"
            />

            {category === 'All' ? (
                <div className="flex flex-col gap-2">
                    {groups.map((group) => {
                        // Searching opens every group so matches are visible.
                        const isOpen = openGroups[group.category] || term !== ''
                        const colors = CATEGORY_COLORS[group.category]
                        return (
                            <div key={group.category}>
                                <button
                                    onClick={() => setOpenGroups((prev) => ({ ...prev, [group.category]: !prev[group.category] }))}
                                    className={`w-full flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/10 border-l-4 ${colors.accent} rounded-xl px-4 py-2.5 transition-colors`}
                                >
                                    <p className="text-white text-sm font-semibold">
                                        {group.category} <span className="text-white/40 font-normal">({group.items.length})</span>
                                    </p>
                                    <span className="text-white/40 text-sm">{isOpen ? '▾' : '▸'}</span>
                                </button>
                                {isOpen && (
                                    <div className="flex flex-col gap-2 mt-2 ml-2">
                                        {group.items.map((item) => <ItemButton key={item._id} item={item} onPick={onPick} formatPrice={formatPrice} />)}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                    {groups.length === 0 && <p className="text-white/40 text-sm text-center py-4">No parts match.</p>}
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {oneCategory.map((item) => <ItemButton key={item._id} item={item} onPick={onPick} formatPrice={formatPrice} />)}
                    {oneCategory.length === 0 && <p className="text-white/40 text-sm text-center py-4">No parts in {category}{term ? ' match' : ''}.</p>}
                </div>
            )}
        </div>
    )
}
