import { loadDashboardData } from '#lib/data.js';

export async function load({ fetch }) {
	return loadDashboardData(fetch);
}
