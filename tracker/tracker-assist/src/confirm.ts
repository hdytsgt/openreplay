
const declineIcon = `<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 128 128" ><g id="Circle_Grid" data-name="Circle Grid"><circle cx="64" cy="64" fill="#ef5261" r="64"/></g><g id="icon"><path d="m57.831 70.1c8.79 8.79 17.405 12.356 20.508 9.253l4.261-4.26a7.516 7.516 0 0 1 10.629 0l9.566 9.566a7.516 7.516 0 0 1 0 10.629l-7.453 7.453c-7.042 7.042-27.87-2.358-47.832-22.319-9.976-9.981-16.519-19.382-20.748-28.222s-5.086-16.091-1.567-19.61l7.453-7.453a7.516 7.516 0 0 1 10.629 0l9.566 9.563a7.516 7.516 0 0 1 0 10.629l-4.264 4.271c-3.103 3.1.462 11.714 9.252 20.5z" fill="#eeefee"/></g></svg>`;

export default function confirm(text: string, styles?: Object): Promise<boolean> {
  return new Promise(resolve => {

    const wrapper = document.createElement('div');
    const popup = document.createElement('div');
    const p = document.createElement('p');
    p.innerText = text;
    const buttons = document.createElement('div');
    const answerBtn = document.createElement('button');
    answerBtn.innerHTML = declineIcon.replace('fill="#ef5261"', 'fill="green"');
    const declineBtn = document.createElement('button');
    declineBtn.innerHTML = declineIcon;
    buttons.appendChild(answerBtn);
    buttons.appendChild(declineBtn);
    popup.appendChild(p);
    popup.appendChild(buttons);

    const btnStyles = {
      borderRadius: "50%",
      width: "20px",
      height: "20px",
      background: "transparent",
      padding: 0,
      margin: 0,
      border: 0,
      cursor: "pointer",
    }
    Object.assign(answerBtn.style, btnStyles);
    Object.assign(declineBtn.style, btnStyles);
    Object.assign(buttons.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-evenly",
    });

    Object.assign(popup.style, {
      position: "relative",
      pointerEvents: "auto",
      margin: "4em auto",
      width: "90%",
      maxWidth: "400px",
      padding: "25px 30px",
      background: "black",
      opacity: ".75",
      color: "white",
      textAlign: "center",
      borderRadius: ".25em .25em .4em .4em",
      boxShadow: "0 0 20px rgb(0 0 0 / 20%)", 
    }, styles);

    Object.assign(wrapper.style, {
      position: "fixed",
      left: 0,
      top: 0,
      height: "100%",
      width: "100%",
      pointerEvents: "none",
    })


    wrapper.appendChild(popup);
    document.body.appendChild(wrapper);

    answerBtn.onclick = () => {
      document.body.removeChild(wrapper);
      resolve(true);
    }
    declineBtn.onclick = () => {
      document.body.removeChild(wrapper);
      resolve(false);
    }
  })
}