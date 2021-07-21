<script lang="ts">
	export let type: 'action' | 'cancel' | 'tab';
	export let disabled: boolean = false;
	export let smol: boolean = false;
</script>

<button on:click {disabled} class={'btn ' + type} class:smol><slot /></button>

<style>
	.btn {
		color: white;
		border: 2px solid;
		padding: 0.5em;
		border-radius: 0.5em;
		cursor: pointer;
		margin-bottom: 0.2em;
	}

	.btn.tab {
		border: 1px solid black;
		border-radius: 0;
		margin: 0;
	}

	button.btn.cancel.smol,
	button.btn.action.smol {
		padding: 0.1em 0.2em;
		border-radius: 5px;
	}

	.btn.cancel.big,
	.btn.action.big {
		padding: 0.5em 1em;
		border-radius: 0.3em;
		font-size: larger;
	}

	.cancel {
		background-color: rgb(160, 48, 48);
		border-color: rgb(128, 32, 32);
	}

	.action {
		background-color: rgb(48, 160, 48);
		border-color: rgb(32, 128, 32);
	}

	.tab {
		background-color: black;
	}

	.cancel:hover:not(:disabled) {
		background-color: rgb(80, 24, 24);
	}

	.action:hover:not(:disabled) {
		background-color: rgb(24, 80, 24);
	}

	.tab:hover:not(:disabled) {
		background-color: rgb(32, 32, 32);
	}
</style>
