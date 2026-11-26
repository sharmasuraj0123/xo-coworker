export interface SpaceMap {
  groups: {id: string, label: string}[];
  leaves: {id: string, label: string, group: string}[];
  ties: {s: string, t: string, label: string}[];
  milestones: {d: string, t: string}[];
}
