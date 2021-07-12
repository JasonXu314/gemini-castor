import { BBox, RBush3D } from 'rbush-3d';

/**
 * Wrapper class around RBush to create some more type safety and convenience
 */
export default class OurBush3D<T extends BBox> extends RBush3D {
	/**
	 * Creates a new bush
	 */
	constructor() {
		super();
	}

	/**
	 * Inserts a item into the bush
	 * @param item The item to be inserted
	 * @returns the bush
	 */
	public insert(item: T): this {
		return super.insert(item);
	}

	/**
	 * Searches for all items INTERSECTING the region given, did not change parameter
	 * type because we still need to require a rectangular prisim search area
	 * @param bbox the region to search in
	 * @returns the found items
	 */
	public search(bbox: BBox): T[] {
		return super.search(bbox) as T[];
	}

	/**
	 * Gets all the points in the bush in array form
	 * @returns all the points in the bush
	 */
	public all(): T[] {
		return super.all() as T[];
	}

	/**
	 * Bulk-inserts data into the bush; works best for clustered data, not so well
	 * for very loosely-correlated data
	 * @param data data to be bulk-inserted
	 * @returns the bush
	 */
	public load(data: T[]): this {
		return super.load(data);
	}
}
