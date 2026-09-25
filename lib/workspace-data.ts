export type Patient = { id:string; name:string; dob:string; phone:string; insurance:string; reason:string; appointment:string; status:string };

export const emptyPatient: Patient = {
  id:"", name:"", dob:"", phone:"", insurance:"", reason:"", appointment:"", status:"Draft"
};

export const stages = [
  {label:"Reception", href:"/reception", key:"reception"},
  {label:"Nurse", href:"/nurse", key:"nurse"},
  {label:"Doctor", href:"/doctor", key:"doctor"},
  {label:"Clinical Insights", href:"/clinical-insights/current", key:"clinical-insights"},
  {label:"Clinical Record", href:"/clinical-record/current", key:"clinical-record"},
  {label:"Outputs", href:"/outputs/current", key:"outputs"}
];
