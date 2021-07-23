<script lang="ts">
	import { createEventDispatcher } from 'svelte/internal';

	export let label: string;
	export let value: string;
	export let id: string;
	export let dark: boolean = false;
	export let disabled: boolean = false;

	const dispatch = createEventDispatcher();
</script>

<div class="main">
	<input
		class:dark
		class="input"
		class:contentful={value !== ''}
		type="text"
		name={id}
		{id}
		{disabled}
		autocomplete="off"
		on:blur={(evt) => dispatch('blur', evt)}
		on:keypress={(evt) => dispatch('change', evt)}
		bind:value
	/>
	<label class="label" class:dark for={id}>{label}</label>
</div>

<style>
	.main {
		position: relative;
		margin-top: 0.25em;
	}

	.input {
		padding: 0.5em;
		text-indent: 4px;
		border: 1px solid rgb(48, 160, 48);
		border-radius: 0.5em;
		outline: none;
	}

	.input.dark {
		background: rgba(0, 0, 0, 0);
		color: white;
	}

	.label {
		position: absolute;
		top: calc(0.5em + 1px);
		left: calc(0.5em + 5px);
		font: 400 13.3333px Arial;
		transition: all 250ms ease-in-out;
		pointer-events: none;
	}

	.label.dark {
		color: white;
	}

	.input.contentful ~ .label,
	.input:focus ~ .label {
		font-size: 0.5em;
		transition: all 250ms ease-in-out;
		color: rgb(48, 160, 48);
		background: white;
		top: -0.5em;
		left: 1em;
		padding: 0 0.25em;
	}

	.input.contentful ~ .label.dark,
	.input:focus ~ .label.dark {
		background: black;
	}
</style>
