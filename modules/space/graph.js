// @ts-check
import { esc } from "../../core/platform/util.js";

/** @param {import("../../core/platform/explore-types").SpaceMap} map @param {string} selected */
export function graphView(map, selected) {
  const nodes = [...new Set(map.ties.flatMap(edge => [edge.s, edge.t]))];
  if (!nodes.length) return "<p>No relationships.</p>";
  const labels = new Map([...map.groups, ...map.leaves].map(node => [node.id, node.label]));
  const center = nodes.includes(selected) ? selected : nodes[0];
  const choices = nodes.map(id => `<option value="${esc(id)}"${id === center ? " selected" : ""}>${esc(labels.get(id) || id)}</option>`);
  const links = map.ties.filter(edge => edge.s === center || edge.t === center).map(edge => {
    const neighbor = edge.s === center ? edge.t : edge.s;
    return `<li><button class="btn" data-node="${esc(neighbor)}">${esc(labels.get(neighbor) || neighbor)}</button>`
      + `<small>${esc(edge.label)}</small></li>`;
  });
  return `<label>Explore relationships <select data-graph-select>${choices.join("")}</select></label>`
    + `<div class="space-graph"><strong>${esc(labels.get(center) || center)}</strong><ul>${links.join("")}</ul></div>`;
}
