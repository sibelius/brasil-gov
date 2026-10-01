import { useEffect } from 'react'
import { OfficialBanner } from '../components/layout/official-banner'
import { Footer } from '../components/layout/site-footer'
import { Hero } from '../components/home/hero'
import { Feature } from '../components/home/feature'
import { Contribute } from '../components/home/contribute'
import { AgencySeals, Collage, Devices, UpcomingCards } from '../components/home/visuals'
import { Reveal } from '../components/reveal'
import { LockKeyhole } from 'lucide-react'
import { navigate } from '../routes/navigation'

export default function HomePage() {
  useEffect(() => {
    document.title = 'Brasil.gov · Tudo o que você precisa do governo, começa aqui'

    const id = window.location.hash.slice(1)
    const timer = setTimeout(() => document.getElementById(id)?.scrollIntoView(), 50)

    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      <OfficialBanner />
      <Hero />
      <main>
        <Feature
          id="como-funciona"
          visual={<Collage />}
          title={
            <>
              Serviços públicos
              <br />
              em um só lugar.
            </>
          }
          body="Chega de pular de site em site. O Brasil.gov reúne os serviços de ministérios, autarquias, estados e prefeituras em um só lugar."
          cta="Veja como funciona"
          onCta={() => navigate('/chat')}
        />
        <Feature
          id="privacidade"
          visual={
            <div className="lock-wrap">
              <div className="lock">
                <LockKeyhole size={40} aria-hidden="true" />
              </div>
            </div>
          }
          title={
            <>
              O Brasil.gov mantém
              <br />
              seus dados privados.
            </>
          }
          body="A busca acontece no seu navegador. A conversa fica apenas nesta sessão; o catálogo e os serviços consultados podem ser guardados no aparelho para agilizar novos acessos. Não insira dados pessoais."
          cta="Saiba mais sobre privacidade"
        />
        <Feature
          id="fontes"
          visual={<AgencySeals />}
          title={
            <>
              Respostas claras.
              <br />
              Fontes oficiais.
            </>
          }
          body="Consulte descrições e etapas do catálogo gov.br coletado em 1º de outubro de 2026. Os links levam às páginas oficiais, onde você pode confirmar as informações atuais."
          cta="Saiba mais sobre as fontes"
        />
        <Feature
          visual={<Devices />}
          title="Nada para baixar."
          body="É só abrir o Brasil.gov no navegador do celular, do tablet ou do computador."
          cta="Faça uma pergunta"
          onCta={() => navigate('/chat')}
        />

        <section className="coming" id="em-breve">
          <Reveal>
            <h2 className="display-md">Mais novidades em 2027</h2>
            <p className="lead">
              Indo além das respostas: você vai poder preencher formulários, acompanhar pedidos e
              organizar tudo em um só lugar.
            </p>
            <button className="pill-btn" disabled>
              Veja o que vem por aí
            </button>
          </Reveal>
          <UpcomingCards />
        </section>
        <Contribute />
      </main>
      <Footer />
    </>
  )
}
