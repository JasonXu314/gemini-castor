<script>
	import Button from '../Button.svelte';
</script>

<div class="main">
	<div class="nav">
		<Button type="tab">Collapse</Button>
	</div>
	<div class="body" />
</div>

<style>
	.main {
		position: absolute;
		display: flex;
		flex-direction: column;
		bottom: 0;
		left: 0;
		background: rgba(0, 0, 0, 0.5);
		width: 100%;
	}

	.main .nav {
		display: flex;
		flex-direction: row;
		border-bottom: 1px solid white;
	}

	.main .body {
		min-height: 10em;
	}
</style>
