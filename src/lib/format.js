import * as d3 from 'd3';

export const fmtInt = d3.format(',');
export const fmtMiles = (v) => (v == null ? 'no data' : `${d3.format(',.1f')(v)} mi`);
export const fmtChange = (v) => (v == null ? 'no data' : `${v > 0 ? '+' : ''}${d3.format(',.1f')(v)} mi`);
export const fmtRate = (v) => (v == null ? 'no data' : d3.format('.2f')(v));
