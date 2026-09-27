import { useEffect, useState } from "react";
import type { Schema } from "../amplify/data/resource";
import { generateClient } from "aws-amplify/data";

import { useAuthenticator } from '@aws-amplify/ui-react';

const client = generateClient<Schema>();

function App() {
  const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);

  useEffect(() => {
    client.models.Todo.observeQuery().subscribe({
      next: (data) => setTodos([...data.items]),
    });
  }, []);

  function createTodo() {
    client.models.Todo.create({ content: window.prompt("Todo content") });
  }

  function deleteTodo(id: string) {
    client.models.Todo.delete({ id });
  }

async function createTestCollectionRecord() {
  const { data, errors } = await client.models.CollectionRecord.create(
    {
      recordNumber: 1,
      location: "テスト地点",
      locationRomaji: "Test location",
      latitude: 35.0,
      longitude: 137.0,
      altitude: 100,
      date: "2026-09-27",
      collector: "テスト",
      collectingMethod: "灯火",
    },
    { authMode: "userPool" }
  );

  if (errors?.length || !data) {
    window.alert(errors?.map((e) => e.message).join("\n") || "保存に失敗しました");
    return;
  }

  window.alert(`採集記録を保存しました。ID: ${data.id}`);
}
  
  const { signOut } = useAuthenticator();


  return (
    <main>
      <h1>My todos</h1>
      <button onClick={createTodo}>+ new</button>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id} onClick={() => deleteTodo(todo.id)}>{todo.content}</li>
        ))}
      </ul>
      <div>
        🥳 App successfully hosted. Try creating a new todo.
        <br />
        <a href="https://docs.amplify.aws/react/start/quickstart/#make-frontend-updates">
          Review next step of this tutorial.
        </a>
      </div>

      <button onClick={createTestCollectionRecord}>
        テスト採集記録を保存
      </button>
      
      <button onClick={signOut}>ログアウト</button>
    </main>
  );
}

export default App;
