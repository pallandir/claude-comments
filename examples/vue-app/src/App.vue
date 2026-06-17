<script setup>
const cards = [
  { id: "revenue", label: "Total revenue", value: "$48,200" },
  { id: "users", label: "Active users", value: "1,284" },
  { id: "churn", label: "Churn rate", value: "2.1%" },
];
</script>

<template>
  <main class="page">
    <header class="topbar">
      <h1 class="title">Vue dashboard</h1>
      <button class="cta" type="button">New report</button>
    </header>

    <section class="cards">
      <article v-for="card in cards" :key="card.id" class="card">
        <span class="card-label">{{ card.label }}</span>
        <strong class="card-value">{{ card.value }}</strong>
      </article>
    </section>
  </main>
</template>

<style>
body { margin: 0; font-family: system-ui, sans-serif; background: #f5f5f4; }
.page { max-width: 880px; margin: 0 auto; padding: 32px; }
.topbar { display: flex; align-items: center; justify-content: space-between; }
.title { font-size: 22px; margin: 0; }
.cta { padding: 8px 16px; border: 0; border-radius: 8px; background: #41b883; color: #07271a; font-weight: 600; cursor: pointer; }
.cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 32px; }
.card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); display: flex; flex-direction: column; gap: 8px; }
.card-label { color: #78716c; font-size: 13px; }
.card-value { font-size: 24px; }
</style>
