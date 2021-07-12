<script lang="ts">
	export let value: number;
	export let label: string;
	export let min: number;
	export let max: number;
	export let disabled: boolean;
	export let softMin: number = min;
	export let softMax: number = max;

	let eagerValue: string = String(value);

	$: eagerValue = String(value);
</script>

<div class="main">
	{label}:
	<input
		type="range"
		{min}
		{max}
		{disabled}
		on:input={(evt) => {
			try {
				const val = Number(evt.currentTarget.value);
				if ((softMax === max ? val <= max : val < softMax) && (softMin === min ? val >= min : val > softMin)) {
					value = val;
					eagerValue = String(value);
					evt.currentTarget.value = String(value);
				} else if (softMax !== max && val >= softMax) {
					value = softMax - 1;
					eagerValue = '' + value;
					evt.currentTarget.value = String(value);
				} else if (softMin !== min && val <= softMin) {
					value = softMin + 1;
					eagerValue = String(value);
					evt.currentTarget.value = String(value);
				} else {
					value = val;
					eagerValue = String(value);
					evt.currentTarget.value = String(value);
				}
			} catch (e) {}
		}}
		{value}
	/>
	<input
		class="subtle-input"
		type="text"
		on:blur={() => {
			if (!disabled) {
				const numEagerVal = Number(eagerValue);
				if ((softMax === max ? numEagerVal <= max : numEagerVal < softMax) && (softMin === min ? numEagerVal >= min : numEagerVal > softMin)) {
					value = numEagerVal;
				} else {
					eagerValue = String(value);
				}
			}
		}}
		{disabled}
		bind:value={eagerValue}
	/>
</div>

<style>
	.main {
		margin-top: -0.2em;
		margin-bottom: 0.2em;
	}

	.main .subtle-input {
		border: 0;
		border-bottom: 1px solid #666666;
	}
</style>
