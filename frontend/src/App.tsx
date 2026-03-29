import { ChangeEvent, useState } from 'react'

export default function App() {
  const [text, setText] = useState('')
  const [, setConfirmedText] = useState('')

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextText = event.target.value
    setText(nextText)
  }

  const handleConfirm = () => {
    setConfirmedText(text)
  }

  return (
    <main className="app">
      <section className="card">
        <h1>Анализ частотности demo</h1>
        <p>Введите текст для анализа</p>

        <textarea
          className="textbox"
          placeholder="Напишите что-нибудь..."
          value={text}
          onChange={handleChange}
        />

        <button className="confirm-button" type="button" onClick={handleConfirm}>
          Анализ
        </button>
      </section>
    </main>
  )
}
