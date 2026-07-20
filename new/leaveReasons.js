// leaveReasons.js - Centralized leave reason options

export const REASON_OPTIONS = {
  FRL: [
    'Moving to a new House',
    'To attend a family event',
    'To take family to and from Island',
    'Urgent work at home',
    'Baby sitting',
    'Parent-Teacher meeting',
    'House Renovation',
    'Family member sick/admitted',
    'Court appearance',
    'To attend a funeral'
  ],
  SL: [
    'Abdominal pain',
    'Abdominal Bleeding',
    'Abdominal Thyroid Function',
    'Abrasion Wound',
    'Accident Injuries',
    'ACL Reconstruction',
    'ACL Tear',
    'Acute Exacerbation for COPD',
    'Acute Febrile Illness',
    'Acute Nasopharyngitis',
    'Acute Respiratory Infection',
    'Acute Rhinitis',
    'Adjustment Disorder',
    'Admitted in Hospital',
    'AGE',
    'Allergic',
    'Ankle Fracture',
    'Ankle Sprain',
    'Anxiety',
    'APD/MSD',
    'Appendisitis',
    'Arm Pain',
    'Arm Sprain',
    'Arthritis',
    'Asthma',
    'Back Pain',
    'Bacterial Conjunctivitis',
    'Bed Rest',
    'Body Pain',
    'Bronchitis',
    'Burn Injury',
    'Cervical Disc Disorder',
    'Chest Pain',
    'Chickenpox',
    'Chikungunya',
    'Chronic Sinusitis',
    'Clavicle Fracture',
    'Common Cold / Flu and Fever',
    'Conjunctivitis',
    'Constipation',
    'Contusion of Lower Back',
    'Coronary Artery Disease',
    'Cough',
    'Cramp & Spasm',
    'Crush Injury',
    'Dehydration',
    'Dengue',
    'Dental issue',
    'Depression',
    'Diabetes',
    'Diarrhea',
    'Disorder of Refraction',
    'Dizziness',
    'Ear Pain',
    'Eye Infection',
    'Fatigue',
    'Fever',
    'Food Poison',
    'Fracture',
    'Gastric',
    'Giddiness',
    'Hand Pain',
    'Headache',
    'Hernia',
    'Hypertension / Blood Pressure',
    'Infection',
    'Injury',
    'Joint Pain',
    'Knee Injury',
    'Lactose Intolerance',
    'Leg Fracture',
    'Leg Pain',
    'Loose Motion',
    'Lumber Strain',
    'Medical Appointments',
    'Medical Illness',
    'Menstrual Pain',
    'Migraines',
    'Minor surgery',
    'Muscle Pain',
    'Pharyngitis',
    'Physical injuries',
    'Senile Cataract',
    'Spasrnodic Torticollis',
    'Stomach upset',
    'Tonsillitis',
    'Viral Conjunctivitis'
  ]
};

// Helper function to get reasons for a specific leave type
export function getReasonsForType(type) {
  return REASON_OPTIONS[type] || [];
}

// Helper function to check if a reason exists for a type
export function isValidReason(type, reason) {
  const reasons = getReasonsForType(type);
  return reasons.includes(reason);
}

// Helper function to get all leave types
export function getLeaveTypes() {
  return Object.keys(REASON_OPTIONS);
}

// Helper function to get random reason (for testing)
export function getRandomReason(type) {
  const reasons = getReasonsForType(type);
  if (reasons.length === 0) return null;
  return reasons[Math.floor(Math.random() * reasons.length)];
}
