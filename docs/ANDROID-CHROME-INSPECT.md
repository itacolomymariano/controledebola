# Chrome inspect no Android (Controle de Bola)

Nao existe campo para digitar `com.minhapelada.app`. Esse texto so aparece **sozinho**, abaixo do nome do celular, quando o WebView e debuggable.

## Requisitos

- APK **debug** (`npm run install:android:debug`). Release e Play Store **nao** inspecionam.
- Cabo USB + Depuracao USB.
- No A37: Opcoes do desenvolvedor → **Depuracao USB (configuracoes de seguranca)** (segundo toggle).
- App **aberto em primeiro plano** (nao no launcher).

## Passos

1. Instalar debug (JDK 21 / JBR).
2. Abrir o Controle de Bola e deixar a tela ligada.
3. No Chrome do PC: `chrome://inspect/#devices` → Discover USB devices.
4. Abaixo de **SM-A376B** deve surgir `WebView in com.minhapelada.app` → **inspect**.
5. Se so o telefone aparecer: atualizar a pagina, confirmar `DEBUGGABLE` com `adb shell dumpsys package com.minhapelada.app`, ou tentar `edge://inspect/#devices`.

Prints do manual tambem podem ser captura nativa da Samsung, sem inspect.
