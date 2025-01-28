export const defaultSubjectConfig = {
  S1: { name: "Maths", subject_credit: 4, color: "#077187" },
  S2: { name: "CO", subject_credit: 4, color: "#cc2936" }, //
  S3: { name: "DSA", subject_credit: 5, color: "#2F1847" },
  S4: { name: "EC", subject_credit: 5, color: "#058c42" },
  S5: { name: "PD", subject_credit: 1, color: "#2F1847" },
  S6: { name: "IT", subject_credit: 4, color: "#cc2936" },
  S7: { name: "Signals", subject_credit: 4, color: "#077187" },
};

export const noOfWeeks = 12;
//no. of weeks in a sem 

export const credit_to_maxbunks = (subject_credit) => {
  return (Math.floor((subject_credit * noOfWeeks * 0.2)); //-1 to make it safe 
};

