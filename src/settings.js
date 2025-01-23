export const defaultSubjectConfig = {
  S1: { name: "Maths", subject_credit: 4, color: "cyan" },
  S2: { name: "CO", subject_credit: 4, color: "rgb(178, 54, 79)" },
  S3: { name: "DSA", subject_credit: 5, color: "limegreen" },
  S4: { name: "EC", subject_credit: 5, color: "orange" },
  S5: { name: "PD", subject_credit: 1, color: "blueviolet" },
  S6: { name: "IT", subject_credit: 4, color: "greenyellow" },
  S7: { name: "Signals", subject_credit: 4, color: "royalblue" },
};

export const noOfWeeks = 12;
//no. of weeks in a sem 

export const credit_to_maxbunks = (subject_credit) => {
  return (Math.floor((subject_credit * noOfWeeks * 0.2) )- 1); //-1 to make it safe 
};

