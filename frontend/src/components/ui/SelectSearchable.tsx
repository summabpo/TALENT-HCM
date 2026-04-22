import Select, {
  type GroupBase,
  type Props as ReactSelectProps,
  type StylesConfig,
} from 'react-select'

export type SearchableOption = { value: string; label: string }

/**
 * Filtro por inicio de nombre o inicio de palabra (p. ej. "uru" → Uruguay;
 * "ur" en medio de "BURUNDI" no coincide).
 */
function filterByPrefix(
  option: { label: string; value: string; data: unknown },
  input: string,
): boolean {
  const q = input.trim().toLowerCase()
  if (!q) return true
  const label = String(option.label).toLowerCase()
  if (label.startsWith(q)) return true
  return label
    .split(/[\s,.;()/-]+/)
    .filter(Boolean)
    .some((w) => w.startsWith(q))
}

const navy = '#212f87'
const magenta = '#d52680'
const border = '#e5e7eb'

/**
 * Select estilo “Select2”: búsqueda, lista con scroll, portal al body (z-index).
 * Colores SUMMA: Navy / Magenta.
 */
function buildStyles<T extends SearchableOption>(): StylesConfig<T, false, GroupBase<T>> {
  return {
    control: (base, state) => ({
      ...base,
      minHeight: 40,
      borderRadius: '0.375rem',
      borderColor: state.isFocused ? magenta : border,
      boxShadow: state.isFocused ? `0 0 0 1px ${magenta}` : 'none',
      '&:hover': { borderColor: state.isFocused ? magenta : border },
    }),
    menu: (base) => ({
      ...base,
      borderRadius: '0.375rem',
      overflow: 'hidden',
      boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.12), 0 8px 10px -6px rgb(0 0 0 / 0.08)',
    }),
    menuList: (base) => ({
      ...base,
      maxHeight: 320,
      padding: 4,
    }),
    menuPortal: (base) => ({ ...base, zIndex: 10050 }),
    option: (base, { isSelected, isFocused }) => ({
      ...base,
      cursor: 'pointer',
      borderRadius: '0.25rem',
      backgroundColor: isSelected ? magenta : isFocused ? 'rgba(213, 38, 128, 0.12)' : 'transparent',
      color: isSelected ? '#fff' : navy,
      fontWeight: isSelected ? 600 : 400,
    }),
    singleValue: (base) => ({ ...base, color: navy }),
    input: (base) => ({ ...base, color: navy }),
    placeholder: (base) => ({ ...base, color: '#6b7280' }),
    indicatorSeparator: () => ({ display: 'none' }),
    dropdownIndicator: (base, state) => ({
      ...base,
      color: state.isFocused ? magenta : '#9ca3af',
    }),
  }
}

export default function SelectSearchable<T extends SearchableOption = SearchableOption>(
  props: Omit<ReactSelectProps<T, false, GroupBase<T>>, 'styles' | 'classNamePrefix'> & {
    /** Si el menú se renderiza en document.body (recomendado en modales/cards). */
    usePortal?: boolean
    /**
     * 'prefix' (default) — comienzo de nombre o de palabra.
     * 'none' — no filtrar en cliente (p. ej. resultados ya filtrados en el API).
     */
    clientFilter?: 'prefix' | 'none'
  },
) {
  const { usePortal = true, clientFilter = 'prefix', ...rest } = props
  return (
    <Select<T, false, GroupBase<T>>
      styles={buildStyles<T>()}
      classNamePrefix="summa-select"
      menuPosition="fixed"
      menuPlacement="auto"
      menuPortalTarget={usePortal && typeof document !== 'undefined' ? document.body : null}
      isSearchable
      filterOption={
        clientFilter === 'none'
          ? () => true
          : (option, raw) => filterByPrefix(option as { label: string; value: string; data: unknown }, raw)
      }
      {...rest}
    />
  )
}
