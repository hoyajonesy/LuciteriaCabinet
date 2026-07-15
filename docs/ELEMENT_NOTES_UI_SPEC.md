# Element Notes UI Specification

## Overview
Element Notes allow collectors to add personal context to each item in their collection: acquisition date, source, price paid, condition, storage location, and free-form notes. Notes are private by default and accessible via a quick drawer/modal from any element card.

---

## Core Features

### 1. Quick Access
- **Trigger**: Single click/tap on "Add Notes" button on element card
- **Location**: Accessible from:
  * Cabinet view (periodic table element cards)
  * Collection grid view (owned items)
  * Wishlist view (for planning/tracking)

### 2. Seven Note Fields
| Field | Type | Purpose | Required |
|-------|------|---------|----------|
| Acquisition Date | Date | When you acquired this element | No |
| Source | Text | Where you bought it (shop, gift, trade) | No |
| Price Paid | Currency | How much you paid | No |
| Condition | Select | Condition rating (Mint, Good, Fair) | No |
| Storage Location | Text | Where you store it (cabinet shelf, safe) | No |
| Notes | Textarea | Free-form personal notes | No |
| Private | Toggle | Visibility control (private by default) | Yes |

### 3. Privacy
- **Default**: All notes are private (only visible to owner)
- **Future**: Optional sharing with other collectors (Phase 3+)

---

## UI Wireframes

### A. Element Card with Notes Indicator

#### Without Notes (Default State)
```
┌─────────────────────────────┐
│           Carbon            │
│             C               │
│          [Symbol]           │
│       Atomic #: 6           │
│                             │
│  Status: ✓ Owned            │
│                             │
│  [Add Notes]                │
└─────────────────────────────┘
```

#### With Notes (Indicator Shown)
```
┌─────────────────────────────┐
│           Carbon            │
│             C               │
│          [Symbol]           │
│       Atomic #: 6           │
│                             │
│  Status: ✓ Owned   📝       │
│                             │
│  [View Notes]               │
└─────────────────────────────┘
```

**Indicator**: 📝 icon in top-right or next to status badge when notes exist

---

### B. Notes Drawer (Desktop)

**Trigger**: Click "Add Notes" or "View Notes" on element card

**Layout**: Slide-in drawer from right side (400px wide)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Cabinet View                                                             │
│                                                                          │
│  ┌─────┐ ┌─────┐ ┌─────┐         ┌─────────────────────────────────────┤
│  │  H  │ │ He  │ │ Li  │         │ Carbon (C) Notes        [✕ Close]   │
│  └─────┘ └─────┘ └─────┘         │                                     │
│  ┌─────┐ ┌─────┐ ┌─────┐         │ 📝 Personal Details                 │
│  │  Be │ │  B  │ │ ▶C◀ │         │                                     │
│  └─────┘ └─────┘ └─────┘         │ Acquisition Date                    │
│                                   │ ┌─────────────────────────────────┐ │
│  [More elements...]               │ │ May 15, 2024        [📅]        │ │
│                                   │ └─────────────────────────────────┘ │
│                                   │                                     │
│                                   │ Source                              │
│                                   │ ┌─────────────────────────────────┐ │
│                                   │ │ Luciteria.com                   │ │
│                                   │ └─────────────────────────────────┘ │
│                                   │                                     │
│                                   │ Price Paid                          │
│                                   │ ┌─────────────────────────────────┐ │
│                                   │ │ $ 24.99                         │ │
│                                   │ └─────────────────────────────────┘ │
│                                   │                                     │
│                                   │ Condition                           │
│                                   │ ┌─────────────────────────────────┐ │
│                                   │ │ Mint ▼                          │ │
│                                   │ └─────────────────────────────────┘ │
│                                   │                                     │
│                                   │ Storage Location                    │
│                                   │ ┌─────────────────────────────────┐ │
│                                   │ │ Display Cabinet, Shelf 2        │ │
│                                   │ └─────────────────────────────────┘ │
│                                   │                                     │
│                                   │ Notes                               │
│                                   │ ┌─────────────────────────────────┐ │
│                                   │ │ First element in my collection! │ │
│                                   │ │ Gift from Sarah for birthday.   │ │
│                                   │ │                                 │ │
│                                   │ │                                 │ │
│                                   │ └─────────────────────────────────┘ │
│                                   │                                     │
│                                   │ Privacy                             │
│                                   │ ☑ Keep these notes private          │
│                                   │                                     │
│                                   │ [Cancel] [Save Notes]               │
│                                   │                                     │
│                                   │ Last updated: 2 days ago            │
└───────────────────────────────────┴─────────────────────────────────────┘
```

---

### C. Notes Drawer (Mobile)

**Trigger**: Tap "Add Notes" on element card

**Layout**: Full-screen modal (slides up from bottom)

```
┌─────────────────────────────────────┐
│ ← Back          Carbon (C) Notes    │
├─────────────────────────────────────┤
│                                     │
│ 📝 Personal Details                 │
│                                     │
│ Acquisition Date                    │
│ ┌─────────────────────────────────┐ │
│ │ May 15, 2024        [📅]        │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Source                              │
│ ┌─────────────────────────────────┐ │
│ │ Luciteria.com                   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Price Paid                          │
│ ┌─────────────────────────────────┐ │
│ │ $ 24.99                         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Condition                           │
│ ┌─────────────────────────────────┐ │
│ │ Mint ▼                          │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Scroll for more fields...]         │
│                                     │
│                                     │
│ [Cancel] [Save Notes]               │
└─────────────────────────────────────┘
```

**Mobile Optimizations**:
- Full-screen overlay (not drawer)
- Bottom action bar with Cancel/Save buttons
- Larger touch targets (48px minimum)
- Native date picker on tap
- Auto-save on field blur (optional)

---

### D. Empty State (No Notes Yet)

```
┌─────────────────────────────────────┐
│ Carbon (C) Notes        [✕ Close]   │
├─────────────────────────────────────┤
│                                     │
│         📝                          │
│                                     │
│   No notes yet for this element     │
│                                     │
│   Add details about when and where  │
│   you acquired this piece, or any   │
│   personal notes you'd like to keep.│
│                                     │
│   [Add Notes]                       │
│                                     │
└─────────────────────────────────────┘
```

After clicking "Add Notes", the form appears with all fields empty.

---

## Field Specifications

### 1. Acquisition Date
**Type**: Date picker

**Format**: MM/DD/YYYY (or user's locale)

**Behavior**:
- Click field → opens calendar dropdown
- Can type date manually
- Default: empty (not pre-filled)
- Validation: Cannot be future date
- Helper text: "When did you acquire this element?"

**UI**:
```
Acquisition Date
┌─────────────────────────────────────┐
│ May 15, 2024            [📅]        │
└─────────────────────────────────────┘
When did you acquire this element?
```

---

### 2. Source
**Type**: Text input (single line)

**Max Length**: 100 characters

**Behavior**:
- Autocomplete suggestions based on previous entries:
  * "Luciteria.com"
  * "Gift from [name]"
  * "eBay"
  * "Local shop"
  * "Trade"
- Case-insensitive
- Trimmed on save

**UI**:
```
Source
┌─────────────────────────────────────┐
│ Luciteria.com                       │
└─────────────────────────────────────┘
Where did you get it?

[Autocomplete dropdown appears if matches found:]
┌─────────────────────────────────────┐
│ ✓ Luciteria.com (used 15 times)    │
│   Luciteria Store (used 3 times)    │
└─────────────────────────────────────┘
```

---

### 3. Price Paid
**Type**: Currency input

**Format**: $ XX.XX (USD default, future: multi-currency)

**Behavior**:
- Numeric keyboard on mobile
- Auto-formats to 2 decimal places
- Optional (collectors may not want to track)
- Accepts integers or decimals
- Strips non-numeric characters

**Validation**:
- Min: $0.01
- Max: $999,999.99 (arbitrary upper bound)
- Error if negative or invalid

**UI**:
```
Price Paid
┌─────────────────────────────────────┐
│ $ 24.99                             │
└─────────────────────────────────────┘
How much did you pay? (optional)
```

**States**:
- Empty: Shows placeholder "$ 0.00"
- Typing "24.99" → auto-formats to "$ 24.99"
- Invalid input (e.g., "abc") → shows error "Please enter a valid price"

---

### 4. Condition
**Type**: Select dropdown

**Options**:
- **Mint** - Perfect condition, no flaws
- **Good** - Minor wear, fully functional
- **Fair** - Visible wear, some imperfections
- **Poor** - Significant damage or degradation
- **Unknown** - Condition not assessed

**Default**: Empty (no pre-selection)

**UI**:
```
Condition
┌─────────────────────────────────────┐
│ Mint ▼                              │
└─────────────────────────────────────┘

[Dropdown expanded:]
┌─────────────────────────────────────┐
│ ✓ Mint                              │
│   Good                              │
│   Fair                              │
│   Poor                              │
│   Unknown                           │
└─────────────────────────────────────┘
```

**Visual Indicators** (shown on card when condition set):
- Mint: ⭐ (gold star)
- Good: ✅ (green check)
- Fair: ⚠️ (yellow warning)
- Poor: 🔴 (red circle)
- Unknown: ❓ (gray question mark)

---

### 5. Storage Location
**Type**: Text input (single line)

**Max Length**: 100 characters

**Behavior**:
- Autocomplete based on previous entries
- Common suggestions:
  * "Display Cabinet, Shelf X"
  * "Safe"
  * "Desk drawer"
  * "Storage box"
- Helps collectors remember physical location

**UI**:
```
Storage Location
┌─────────────────────────────────────┐
│ Display Cabinet, Shelf 2            │
└─────────────────────────────────────┘
Where do you store this element?
```

---

### 6. Notes
**Type**: Textarea (multi-line)

**Max Length**: 1,000 characters

**Behavior**:
- Free-form text entry
- Line breaks preserved
- Markdown NOT supported in v1 (plain text only)
- Character counter shows remaining space

**UI**:
```
Notes
┌─────────────────────────────────────┐
│ First element in my collection!     │
│ Gift from Sarah for my birthday.    │
│ Sentimental value.                  │
│                                     │
│                                     │
└─────────────────────────────────────┘
987 / 1000 characters remaining
```

**Use Cases**:
- Personal memories ("First element I ever bought")
- Historical context ("Purchased during 2024 sale")
- Future plans ("Want to upgrade to 50mm version")
- Research notes ("Used in chemistry demo")

---

### 7. Privacy Toggle
**Type**: Checkbox

**Default**: ☑ Checked (private)

**Behavior**:
- When checked: Notes visible only to owner
- When unchecked: Notes visible to other collectors (Phase 3+ feature)
- In Phase 2: Always private (toggle shown but grayed out)
- Tooltip: "Public sharing coming soon!"

**UI**:
```
Privacy
┌─────────────────────────────────────┐
│ ☑ Keep these notes private          │
└─────────────────────────────────────┘

[Phase 3+ when unchecked:]
┌─────────────────────────────────────┐
│ ☐ Keep these notes private          │
│                                     │
│ ⚠️ Your notes will be visible to   │
│ other collectors viewing this       │
│ element. Personal data like price   │
│ will remain private.                │
└─────────────────────────────────────┘
```

---

## Interaction Flows

### Flow 1: Adding Notes to New Element

```
User owns Carbon (C)
   │
   ├─ Clicks "Add Notes" on Carbon card in cabinet
   │
   ├─ Notes drawer slides in from right (desktop) or up (mobile)
   │
   ├─ Form shows empty fields
   │
   ├─ User fills out:
   │  • Acquisition Date: May 15, 2024
   │  • Source: Luciteria.com
   │  • Price Paid: $24.99
   │  • Condition: Mint
   │  • Storage Location: Display Cabinet, Shelf 2
   │  • Notes: "First element in my collection!"
   │  • Privacy: ☑ Checked
   │
   ├─ User clicks "Save Notes"
   │
   ├─ Drawer closes, success toast appears: "Notes saved for Carbon"
   │
   ├─ Carbon card now shows 📝 indicator
   │
   └─ Next time user clicks "View Notes", form pre-filled with saved data
```

---

### Flow 2: Editing Existing Notes

```
User has notes for Copper (Cu)
   │
   ├─ Clicks "View Notes" on Copper card
   │
   ├─ Notes drawer opens with pre-filled data
   │
   ├─ User edits "Price Paid" from $15.00 to $18.00
   │
   ├─ User clicks "Save Notes"
   │
   ├─ Drawer closes, success toast: "Notes updated for Copper"
   │
   └─ "Last updated" timestamp refreshed
```

---

### Flow 3: Deleting Notes

```
User wants to remove notes for Iron (Fe)
   │
   ├─ Opens "View Notes" for Iron
   │
   ├─ Clicks "Delete All Notes" button (bottom of form, red text)
   │
   ├─ Confirmation dialog appears:
   │  "Are you sure? This cannot be undone."
   │  [Cancel] [Delete Notes]
   │
   ├─ User clicks "Delete Notes"
   │
   ├─ Notes record deleted from database
   │
   ├─ Drawer closes, toast: "Notes deleted for Iron"
   │
   └─ Iron card no longer shows 📝 indicator
```

---

### Flow 4: Quick Save (Auto-save on blur - Optional Feature)

```
User edits notes for Silver (Ag)
   │
   ├─ Opens notes drawer
   │
   ├─ Changes "Condition" from "Good" to "Mint"
   │
   ├─ Clicks into "Notes" field (blur event on Condition)
   │
   ├─ System auto-saves Condition change in background
   │
   ├─ Small checkmark appears briefly: ✓ Saved
   │
   └─ User can close drawer without clicking "Save" (already saved)
```

**Note**: Auto-save is optional enhancement. For MVP, use explicit "Save Notes" button.

---

## Component States

### 1. Loading State
```
┌─────────────────────────────────────┐
│ Carbon (C) Notes        [✕ Close]   │
├─────────────────────────────────────┤
│                                     │
│          [Loading...]               │
│                                     │
│    Fetching your notes...           │
│                                     │
└─────────────────────────────────────┘
```

### 2. Saving State
```
[Save Notes] button changes to:
[Saving...] (grayed out, spinner icon)
```

### 3. Error State
```
┌─────────────────────────────────────┐
│ ⚠️ Error: Could not save notes     │
│                                     │
│ Please check your connection and    │
│ try again.                          │
│                                     │
│ [Retry]                             │
└─────────────────────────────────────┘
```

### 4. Success Toast
```
┌─────────────────────────────────────┐
│ ✓ Notes saved for Carbon            │
└─────────────────────────────────────┘
(Auto-dismisses after 3 seconds)
```

---

## Technical Specifications

### Database Schema

#### ElementNote Model
```prisma
model ElementNote {
  id                String    @id @default(cuid())
  userId            String
  collectionItemId  String    @unique
  
  acquisitionDate   DateTime?
  source            String?
  pricePaid         Decimal?  @db.Decimal(10, 2)
  condition         Condition?
  storageLocation   String?
  notes             String?   @db.Text
  isPrivate         Boolean   @default(true)
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  user              User              @relation(fields: [userId], references: [id])
  collectionItem    CollectionItem    @relation(fields: [collectionItemId], references: [id])
  
  @@index([userId])
}

enum Condition {
  MINT
  GOOD
  FAIR
  POOR
  UNKNOWN
}
```

**Key Points**:
- One note record per collection item (1:1 relationship)
- `collectionItemId` is unique constraint (ensures one note per item)
- `pricePaid` stored as Decimal for accuracy
- All fields except `isPrivate` are optional
- `updatedAt` auto-updates on save

---

### API Endpoints

#### GET `/api/notes/:collectionItemId`
**Purpose**: Fetch notes for a specific collection item

**Response**:
```json
{
  "id": "note_abc123",
  "userId": "user_xyz789",
  "collectionItemId": "item_def456",
  "acquisitionDate": "2024-05-15T00:00:00Z",
  "source": "Luciteria.com",
  "pricePaid": 24.99,
  "condition": "MINT",
  "storageLocation": "Display Cabinet, Shelf 2",
  "notes": "First element in my collection! Gift from Sarah.",
  "isPrivate": true,
  "updatedAt": "2024-05-27T14:32:00Z"
}
```

**404 Response** (no notes exist):
```json
{
  "error": "No notes found for this item"
}
```

---

#### POST `/api/notes`
**Purpose**: Create new notes for collection item

**Request Body**:
```json
{
  "collectionItemId": "item_def456",
  "acquisitionDate": "2024-05-15",
  "source": "Luciteria.com",
  "pricePaid": 24.99,
  "condition": "MINT",
  "storageLocation": "Display Cabinet, Shelf 2",
  "notes": "First element in my collection!",
  "isPrivate": true
}
```

**Response**: Same as GET response

---

#### PUT `/api/notes/:noteId`
**Purpose**: Update existing notes

**Request Body**: Same as POST (partial updates allowed)

**Response**: Updated note object

---

#### DELETE `/api/notes/:noteId`
**Purpose**: Delete notes

**Response**:
```json
{
  "success": true,
  "message": "Notes deleted"
}
```

---

### Validation Rules

| Field | Validation |
|-------|------------|
| acquisitionDate | Must be valid date, not in future |
| source | Max 100 chars, trimmed |
| pricePaid | Numeric, 0.01 - 999,999.99 |
| condition | Must be one of enum values |
| storageLocation | Max 100 chars, trimmed |
| notes | Max 1,000 chars |
| isPrivate | Boolean, defaults to true |

---

### Performance Considerations

**Lazy Loading**: Notes only loaded when drawer opened (not pre-fetched for all elements)

**Caching**: Cache notes locally in browser for 5 minutes to avoid repeated API calls

**Debouncing**: If implementing auto-save, debounce saves by 1 second to avoid excessive API calls

**Optimistic Updates**: Update UI immediately on save, then sync with backend. Rollback if save fails.

---

## Accessibility (a11y)

### Keyboard Navigation
- **Tab**: Navigate between fields
- **Enter**: Submit form (when focus on Save button)
- **Escape**: Close drawer without saving
- **Shift+Tab**: Navigate backward

### Screen Reader Support
- Label all form fields with `<label>` tags
- Use `aria-label` for icon buttons
- Announce success/error toasts with `role="alert"`
- Drawer has `role="dialog"` and `aria-modal="true"`

### ARIA Labels
```html
<button aria-label="Add notes for Carbon">Add Notes</button>
<input aria-label="Acquisition date" type="date" />
<textarea aria-label="Personal notes about this element"></textarea>
```

---

## Mobile-Specific Considerations

### Touch Targets
- Minimum 48×48px for all interactive elements
- Larger padding around form fields
- Bottom action bar for easy thumb reach

### Input Types
- `type="date"` → Native date picker
- `type="number"` → Numeric keyboard for price
- `inputmode="decimal"` → Decimal keyboard

### Scrolling
- Drawer content scrolls independently
- Fixed header with element name
- Fixed footer with action buttons
- Content area scrolls in between

---

## Future Enhancements (Post-MVP)

### Phase 3+ Features
1. **Photo Uploads**: Attach photos of the element to notes
2. **Public Sharing**: Share notes with community (controlled by privacy toggle)
3. **Note Templates**: Pre-filled templates for common scenarios
4. **Export**: Download all notes as PDF/CSV
5. **Markdown Support**: Rich text formatting in notes field
6. **Voice Notes**: Record audio notes
7. **Tags**: Custom tags for categorization (e.g., "gift", "rare", "upgrade target")

---

## Design System

### Colors
- **Primary**: #667eea (action buttons)
- **Success**: #48bb78 (save confirmation)
- **Error**: #f56565 (validation errors)
- **Gray**: #718096 (helper text)

### Typography
- **Form Labels**: 14px, medium weight, gray-700
- **Input Text**: 16px, regular weight, black
- **Helper Text**: 12px, regular weight, gray-500
- **Character Counter**: 12px, regular weight, gray-400

### Spacing
- Form field vertical spacing: 24px
- Label to input gap: 8px
- Button spacing: 12px
- Drawer padding: 24px

---

## Summary

**Purpose**: Personal context for collection items  
**Access**: Single click from element card  
**Fields**: 7 (all optional except privacy toggle)  
**Privacy**: Private by default  
**UI**: Drawer (desktop) / Full-screen modal (mobile)  

**Philosophy**: Quick, unobtrusive way to add personal meaning to collections without disrupting browsing flow.
