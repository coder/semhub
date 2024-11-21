import { type SearchOperator } from "@/core/constants/search";
import {
  getFilteredOperators,
  getFilteredStateValues,
  type OperatorWithIcon,
  type StateValue,
} from "@/hooks/useSearchBar";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface SearchDropdownMenuProps {
  commandRef: React.RefObject<HTMLDivElement>;
  commandInputRef: React.RefObject<HTMLInputElement>;
  commandInputValue: string;
  subMenu: SearchOperator | null;
  handleOperatorSelect: (operator: OperatorWithIcon) => void;
  handleValueSelect?: (value: StateValue) => void;
}

function OperatorItems({
  commandInputValue,
  onSelect,
}: {
  commandInputValue: string;
  onSelect: (operator: OperatorWithIcon) => void;
}) {
  return getFilteredOperators(commandInputValue).map((o) => (
    <CommandItem
      key={o.operator}
      onSelect={() => onSelect(o)}
      className="px-4 py-2"
    >
      {o.icon}
      <span className="ml-2">{o.name}</span>
    </CommandItem>
  ));
}

function StateValueItems({
  commandInputValue,
  onSelect,
}: {
  commandInputValue: string;
  onSelect: (value: StateValue) => void;
}) {
  return getFilteredStateValues(commandInputValue, "state").map((s) => (
    <CommandItem key={s.value} onSelect={() => onSelect(s)}>
      {s.icon}
      <span className="ml-2">{s.name}</span>
    </CommandItem>
  ));
}

export function SearchDropdownMenu({
  commandRef,
  commandInputRef,
  commandInputValue,
  subMenu,
  handleOperatorSelect,
  handleValueSelect,
}: SearchDropdownMenuProps) {
  return (
    <Command
      ref={commandRef}
      loop
      className="w-64 bg-transparent"
      style={{
        transform: "translateX(var(--menu-cursor-offset-x, 0))",
      }}
    >
      <CommandInput
        ref={commandInputRef}
        value={commandInputValue}
        className="hidden"
      />
      <CommandList className="mt-2 rounded-lg border bg-popover shadow-lg ring-1 ring-black/5 dark:ring-white/5">
        <CommandGroup>
          {!subMenu && (
            <OperatorItems
              commandInputValue={commandInputValue}
              onSelect={handleOperatorSelect}
            />
          )}
          {subMenu === "state" && handleValueSelect && (
            <StateValueItems
              commandInputValue={commandInputValue}
              onSelect={handleValueSelect}
            />
          )}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
