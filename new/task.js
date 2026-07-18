// task.js – All task definitions

export const MAIN_DAILY_TASKS = [
    { id: "noticeboard", task: "📋 Read the noticeboard", type: "signoff", signoffs: [] },
    { id: "stationaries", task: "📋 Make sure all the stationaries are available at the Reception", type: "complete", completedBy: null, completedAt: null },
    { id: "passengerLoad", task: "📋 Briefed on daily passenger load / Expected", type: "signoff", signoffs: [] },
    { id: "maintenanceChecklist", task: "📋 Ensure daily maintenance checklist done", type: "complete", completedBy: null, completedAt: null },
    { id: "shiftOpen", task: "📋 Check the system and make sure the correct shift is open", type: "complete", completedBy: null, completedAt: null },
    { id: "waterFeature", task: "📋 Make sure the water feature is well maintained and working", type: "complete", completedBy: null, completedAt: null },
    { id: "emailChargeForms", task: "📧 EMAIL CHARGE FORMS / HANDOVER", type: "signoff", signoffs: [] },
    { id: "airlineBoards", task: "🪧 DISPLAY AIRLINE BOARDS", type: "signoff", signoffs: [] },
    { id: "loungeEmail", task: "📋 Check the lounge E-mail", type: "signoff", signoffs: [] },
    { id: "flightsClosed", task: "📋 Check all the flights are closed from the system", type: "signoff", signoffs: [] },
    { id: "tallyCards", task: "📋 Tally the lounge cards with the charge sheets", type: "signoff", signoffs: [] },
    { id: "dailySales", task: "📋 Fill up the Daily Sales Sheet", type: "signoff", signoffs: [] },
    { id: "salesTally", task: "📋 Check Daily Sales Sheet are tally", type: "signoff", signoffs: [] },
    { id: "paymentReceipts", task: "📋 Tally payment receipts with payment system report", type: "signoff", signoffs: [] },
    { id: "pettyCash", task: "📋 Handover Petty Cash Float", type: "signoff", signoffs: [] },
    { id: "allocationHandover", task: "📋 Allocation Handover", type: "signoff", signoffs: [] },
    { id: "flightClosed", task: "📋 Ensure that all the flights are closed from the system", type: "complete", completedBy: null, completedAt: null },
    { id: "closeShift", task: "📋 Close the Shift", type: "complete", completedBy: null, completedAt: null },
    { id: "shiftHandover", task: "📋 Shift Handover, Cash count, & handover, messages, pending works, cards count & handover", type: "complete", completedBy: null, completedAt: null },
    { id: "settlement", task: "📋 Take the settlement report sign with initials", type: "complete", completedBy: null, completedAt: null },
    { id: "cashCountCashier", task: "📋 Count all the receipts tally with cash", type: "complete", completedBy: null, completedAt: null },
    { id: "cashCountWitness", task: "📋 Count all the receipts tally with cash by a Witness", type: "complete", completedBy: null, completedAt: null },
    { id: "signReport", task: "📋 Sign the enclosed report", type: "signoff", signoffs: [] },
    { id: "cashDrop", task: "📋 Drop the Cash bag into the safe box", type: "signoff", signoffs: [] },
    { id: "fileChecklist", task: "📋 File the Check list", type: "signoff", signoffs: [] },
];

export const FB_DAILY_TASKS = [
    { id: "fb_cleanliness", task: "🍽️ Check and maintain the cleanliness of buffet", type: "signoff", signoffs: [] },
    { id: "fb_inductions", task: "🍽️ Check the inductions are ON", type: "signoff", signoffs: [] },
    { id: "fb_nametags", task: "🍽️ Check the name tags are in good condition", type: "signoff", signoffs: [] },
    { id: "fb_milkJar", task: "🍽️ Check & Re-fill the milk Jar", type: "signoff", signoffs: [] },
    { id: "fb_buffetRisers", task: "🍽️ Clean & arrange buffet risers", type: "signoff", signoffs: [] },
    { id: "fb_refrigerator", task: "🍽️ Re-fill the refrigerator", type: "signoff", signoffs: [] },
    { id: "fb_washItems", task: "🍽️ Wash milk Jar, buffet tongs and plates", type: "complete", completedBy: null, completedAt: null },
    { id: "fb_cleanToaster", task: "🍽️ Clean the toaster, tray", type: "complete", completedBy: null, completedAt: null },
    { id: "fb_arrangeCutlery", task: "🍽️ Maintain & arrange cutlery for another shift", type: "complete", completedBy: null, completedAt: null },
    { id: "fb_disinfect", task: "🍽️ Disinfect all touched surfaces", type: "complete", completedBy: null, completedAt: null },
    { id: "fb_floor", task: "🍽️ Check the floor, carpets and vinyl flooring", type: "complete", completedBy: null, completedAt: null },
    { id: "fb_coffeeMachine", task: "🍽️ Check the coffee machine", type: "complete", completedBy: null, completedAt: null },
    { id: "fb_cleanCoffee", task: "🍽️ Clean the coffee machine", type: "complete", completedBy: null, completedAt: null },
    { id: "fb_refillTea", task: "🍽️ Refill the teabags, sugar and cup noodles", type: "complete", completedBy: null, completedAt: null },
    { id: "fb_refillCondiments", task: "🍽️ Refill condiments", type: "complete", completedBy: null, completedAt: null },
    { id: "fb_clearTables", task: "🍽️ Check and clear the tables", type: "signoff", signoffs: [] },
    { id: "fb_disinfectTables", task: "🍽️ Clear & disinfect tables and chairs", type: "signoff", signoffs: [] },
    { id: "fb_checkFloor", task: "🍽️ Check the floor", type: "signoff", signoffs: [] },
    { id: "fb_cleanSofa", task: "🍽️ Clean sofa", type: "signoff", signoffs: [] }
];

// Combine all tasks for easy lookup
export const ALL_TASKS = [...MAIN_DAILY_TASKS, ...FB_DAILY_TASKS];

// Helper to get task by ID
export function getTaskById(id) {
    return ALL_TASKS.find(task => task.id === id);
}

// Helper to get tasks by category
export function getTasksByCategory(category) {
    if (category === 'main') return MAIN_DAILY_TASKS;
    if (category === 'fb') return FB_DAILY_TASKS;
    return ALL_TASKS;
}