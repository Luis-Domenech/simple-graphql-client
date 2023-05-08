import { new_fetch, operation_fetch } from "./generated/sgc/client/index.js"

const main = async () => {
  const res = await operation_fetch('getAllTweets', {id: ['']}, true)

  if (res) {
    if (res.output) {
      
    }
  }

  const new_res = await new_fetch('getAllTweets', {id: ['']}, )

  if (new_res) {
    if (new_res.output) {
      
    }
  }
}

main()