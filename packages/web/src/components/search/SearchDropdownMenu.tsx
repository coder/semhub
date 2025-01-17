import {
  AlignJustifyIcon,
  Building2Icon,
  CircleDashedIcon,
  FolderGit2Icon,
  Heading1Icon,
  LibraryBigIcon,
  TagIcon,
  UserIcon,
} from "lucide-react";

import {
  SEARCH_OPERATORS,
  STATE_SUBMENU_VALUES,
  type SearchOperator,
} from "@/core/constants/search.constant";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface SearchDropdownMenuProps {
  removedOperators?: SearchOperator[];
  commandRef: React.RefObject<HTMLDivElement>;
  commandInputRef: React.RefObject<HTMLInputElement>;
  commandInputValue: string;
  subMenu: SearchOperator | null;
  handleOperatorSelect: (operator: OperatorWithIcon) => void;
  handleValueSelect?: (value: SubmenuValue) => void;
  commandValue: string;
  setCommandValue: (value: string) => void;
}

const preventDefault = (e: React.MouseEvent | React.TouchEvent) => {
  // prevent input from losing focus on touch or click
  e.preventDefault();
};

function OperatorItems({
  commandInputValue,
  onSelect,
  removedOperators,
}: {
  commandInputValue: string;
  onSelect: (operator: OperatorWithIcon) => void;
  removedOperators: SearchOperator[];
}) {
  return getFilteredOperators(commandInputValue, removedOperators).map((o) => (
    <CommandItem
      key={o.operator}
      onSelect={() => onSelect(o)}
      className="px-4 py-2"
      onMouseDown={preventDefault}
      onTouchStart={preventDefault}
    >
      {o.icon}
      <span className="ml-2">{o.name}</span>
    </CommandItem>
  ));
}

function SubmenuValueItems({
  commandInputValue,
  onSelect,
  subMenu,
}: {
  commandInputValue: string;
  onSelect: (value: SubmenuValue) => void;
  subMenu: SearchOperator;
}) {
  return getFilteredSubmenuValues(commandInputValue, subMenu).map((s) => (
    <CommandItem
      key={s.value}
      onSelect={() => onSelect(s)}
      onMouseDown={preventDefault}
      onTouchStart={preventDefault}
    >
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
  commandValue,
  setCommandValue,
  removedOperators = [],
}: SearchDropdownMenuProps) {
  return (
    <Command
      ref={commandRef}
      loop
      className="w-64 bg-transparent"
      shouldFilter={false}
      onValueChange={setCommandValue}
      value={commandValue}
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
              removedOperators={removedOperators}
            />
          )}
          {subMenu === "state" && handleValueSelect && (
            <SubmenuValueItems
              commandInputValue={commandInputValue}
              onSelect={handleValueSelect}
              subMenu={subMenu}
            />
          )}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

const OPERATORS_WITH_ICONS = [
  {
    name: "Title",
    ...SEARCH_OPERATORS[0],
    icon: <Heading1Icon />,
  },
  {
    name: "Author",
    ...SEARCH_OPERATORS[1],
    icon: <UserIcon />,
  },
  {
    name: "Body",
    ...SEARCH_OPERATORS[2],
    icon: <AlignJustifyIcon />,
  },
  {
    name: "Label",
    ...SEARCH_OPERATORS[5],
    icon: <TagIcon />,
  },
  {
    name: "Issue State",
    ...SEARCH_OPERATORS[3],
    icon: <CircleDashedIcon />,
  },
  {
    name: "Repository",
    ...SEARCH_OPERATORS[4],
    icon: <FolderGit2Icon />,
  },
  {
    name: "Org",
    ...SEARCH_OPERATORS[6],
    icon: <Building2Icon />,
  },
  {
    name: "Collection",
    ...SEARCH_OPERATORS[7],
    icon: <LibraryBigIcon />,
  },
] as const;

export type OperatorWithIcon = (typeof OPERATORS_WITH_ICONS)[number];

export interface SubmenuValue {
  name: string;
  value: string;
}

export const OPERATOR_SUBMENU_VALUES = new Map<SearchOperator, SubmenuValue[]>([
  [
    SEARCH_OPERATORS[3].operator, // "state"
    [
      {
        name: "Open",
        value: STATE_SUBMENU_VALUES[0],
      },
      { name: "Closed", value: STATE_SUBMENU_VALUES[1] },
      { name: "All", value: STATE_SUBMENU_VALUES[2] },
    ],
  ],
]);

export function getFilteredOperators(
  word: string,
  removedOperators: SearchOperator[],
) {
  return OPERATORS_WITH_ICONS.filter(
    (o) =>
      !removedOperators.includes(o.operator) &&
      (o.operator.toLowerCase().startsWith(word.toLowerCase()) ||
        o.name.toLowerCase().startsWith(word.toLowerCase())),
  );
}

export function getFilteredSubmenuValues(
  word: string,
  subMenu: SearchOperator | null,
) {
  if (!subMenu) return [];
  const submenuValues = OPERATOR_SUBMENU_VALUES.get(subMenu);
  if (!submenuValues) return [];
  return submenuValues.filter(
    (s) =>
      s.name.toLowerCase().startsWith(word.toLowerCase()) ||
      s.value.toLowerCase().startsWith(word.toLowerCase()),
  );
}
