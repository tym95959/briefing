// task.js – All task definitions for the Staff Dashboard
// Includes: Main Daily, Food & Beverage, Monthly Once, Monthly Twice, and Daily tasks

// -------------------- Main Daily Tasks --------------------
export const MAIN_DAILY_TASKS = [
  { id: 'main_1', task: 'Open all windows for ventilation', type: 'complete' },
  { id: 'main_2', task: 'Check fire extinguishers and emergency exits', type: 'signoff' },
  { id: 'main_3', task: 'Inspect cleanliness of lobby and reception', type: 'complete' },
  { id: 'main_4', task: 'Restock guest amenities in rooms', type: 'complete' },
  { id: 'main_5', task: 'Vacuum all public areas', type: 'complete' },
  { id: 'main_6', task: 'Empty trash bins in common areas', type: 'complete' },
  { id: 'main_7', task: 'Mop floors in corridors', type: 'complete' },
  { id: 'main_8', task: 'Check lighting and replace faulty bulbs', type: 'complete' },
  { id: 'main_9', task: 'Inspect room condition after checkout', type: 'signoff' },
  { id: 'main_10', task: 'Prepare arrival packets for new guests', type: 'complete' },
];

// -------------------- Food & Beverage Daily Tasks --------------------
export const FB_DAILY_TASKS = [
  { id: 'fb_1', task: 'Clean and sanitise all dining tables', type: 'complete' },
  { id: 'fb_2', task: 'Restock buffet utensils and napkins', type: 'complete' },
  { id: 'fb_3', task: 'Check temperature of cold storage units', type: 'signoff' },
  { id: 'fb_4', task: 'Inspect food expiry dates (dry storage)', type: 'complete' },
  { id: 'fb_5', task: 'Clean kitchen worktops and equipment', type: 'complete' },
  { id: 'fb_6', task: 'Refill beverage dispensers', type: 'complete' },
  { id: 'fb_7', task: 'Set up coffee station', type: 'complete' },
  { id: 'fb_8', task: 'Take inventory of glassware and china', type: 'complete' },
  { id: 'fb_9', task: 'Sanitise food preparation area', type: 'complete' },
  { id: 'fb_10', task: 'Check dishwashing machine operation', type: 'signoff' },
];

// -------------------- Monthly Once Tasks --------------------
export const MONTHLY_ONCE_TASKS = [
  { id: 'm1_1', task: 'Deep clean carpets in all rooms', type: 'complete' },
  { id: 'm1_2', task: 'Inspect fire alarm system and detectors', type: 'signoff' },
  { id: 'm1_3', task: 'Clean air conditioning filters', type: 'complete' },
  { id: 'm1_4', task: 'Polish all brass and metal fixtures', type: 'complete' },
  { id: 'm1_5', task: 'Check and lubricate door hinges and locks', type: 'complete' },
  { id: 'm1_6', task: 'Inspect kitchen exhaust hoods', type: 'signoff' },
  { id: 'm1_7', task: 'Deep clean ovens and grills', type: 'complete' },
  { id: 'm1_8', task: 'Test emergency lighting system', type: 'signoff' },
  { id: 'm1_9', task: 'Treat wood surfaces with polish', type: 'complete' },
  { id: 'm1_10', task: 'Inspect and service ice machines', type: 'complete' },
];

// -------------------- Monthly Twice Tasks --------------------
export const MONTHLY_TWICE_TASKS = [
  { id: 'm2_1', task: 'Check and refill first aid kits', type: 'complete' },
  { id: 'm2_2', task: 'Inspect all fire extinguishers (pressure & tags)', type: 'signoff' },
  { id: 'm2_3', task: 'Clean window blinds and curtains', type: 'complete' },
  { id: 'm2_4', task: 'Sanitise all telephones and remote controls', type: 'complete' },
  { id: 'm2_5', task: 'Check plumbing for leaks in guest bathrooms', type: 'complete' },
  { id: 'm2_6', task: 'Dust all artwork and decorative items', type: 'complete' },
  { id: 'm2_7', task: 'Inspect electrical wiring and sockets', type: 'signoff' },
  { id: 'm2_8', task: 'Clean and maintain gym equipment', type: 'complete' },
  { id: 'm2_9', task: 'Check and refill soap dispensers in public toilets', type: 'complete' },
  { id: 'm2_10', task: 'Test smoke detectors and sounders', type: 'signoff' },
];

// -------------------- Daily Tasks (General) --------------------
export const DAILY_TASKS = [
  { id: 'daily_1', task: 'Complete opening checklist for shift', type: 'complete' },
  { id: 'daily_2', task: 'Check and sign off on daily cleaning log', type: 'signoff' },
  { id: 'daily_3', task: 'Ensure all guest requests are fulfilled', type: 'complete' },
  { id: 'daily_4', task: 'Restock minibars in all rooms', type: 'complete' },
  { id: 'daily_5', task: 'Review and update lost and found register', type: 'complete' },
  { id: 'daily_6', task: 'Check and reset room thermostats', type: 'complete' },
  { id: 'daily_7', task: 'Inspect public area signage for damage', type: 'complete' },
  { id: 'daily_8', task: 'Collect and sort daily mail', type: 'complete' },
  { id: 'daily_9', task: 'Confirm reservations for next day', type: 'complete' },
  { id: 'daily_10', task: 'Prepare daily report for supervisor', type: 'signoff' },
];

// Optionally, a utility function to get tasks by category (if needed)
export function getTasksByCategory(category) {
  const map = {
    main: MAIN_DAILY_TASKS,
    fb: FB_DAILY_TASKS,
    monthly_once: MONTHLY_ONCE_TASKS,
    monthly_twice: MONTHLY_TWICE_TASKS,
    daily: DAILY_TASKS,
  };
  return map[category] || [];
}
