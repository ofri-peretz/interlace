---
'@interlace/ui': minor
---

Call it before it happens. `Prediction` lets each person lock in one outcome ("Who wins the next round?") and keeps the room's calls hidden until the host settles it, so every call is the person's own read. Once settled it says in words whether the viewer called it, with the points, and shows how the room called it with the outcome marked. `games/prediction-model` settles calls keyed by person (`settlePredictions`), so a duplicate or late message changes nothing and an unknown option is dropped, and `predictionPoints` can pay a call few people made up to twice as much (`reward: 'bold'`).

Components: prediction
